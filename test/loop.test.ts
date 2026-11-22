import { describe, expect, it } from "vitest"
import { HouseLoop } from "../src/agent/loop.js"
import type { Executor } from "../src/agent/executor.js"
import type { Planner } from "../src/agent/planner.js"
import { FakeComputer } from "../src/computer/computer.js"
import type { AgentAction, Step, Verdict } from "../src/domain/types.js"
import { Vault, loadKey } from "../src/vault/vault.js"
import { randomBytes } from "node:crypto"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const step = (): Step => ({
  id: "s1",
  text: "Open the site and read the heading",
  site: "https://example.com",
  doneWhen: "heading visible",
  commit: false,
  status: "pending",
  pause: false,
  userPause: false,
})

function planner(reviewQueue: Verdict[]): Planner & { plans: number; reviews: number } {
  return {
    plans: 0,
    reviews: 0,
    async plan() {
      this.plans += 1
      return { end: "heading visible", steps: [step()] }
    },
    async review() {
      this.reviews += 1
      return reviewQueue.shift() ?? { type: "approve" }
    },
  }
}

function executor(actions: AgentAction[]): Executor {
  return {
    async next() {
      return actions.shift() ?? { type: "done", evidence: "heading visible" }
    },
  }
}

async function run(level: 1 | 2, actions: AgentAction[], reviews: Verdict[] = []) {
  const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
  const computer = new FakeComputer(dir)
  computer.text = "heading visible"
  const plan = planner(reviews)
  const order: string[] = []
  const loop = new HouseLoop({
    planner: plan,
    executor: executor(actions),
    computer,
    vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
    level,
    language: "en",
    emit: () => undefined,
  })
  const wake = computer.wake.bind(computer)
  computer.wake = async () => {
    order.push(loop.mission?.end ? "end-then-wake" : "wake-before-end")
    await wake()
  }
  await loop.acceptMission("Open the site and stop when the heading is visible")
  return { loop, computer, plan, order }
}

describe("mission loop", () => {
  it("saves the end before Chrome wakes, then reviews only the done action", async () => {
    const { loop, computer, plan, order } = await run(2, [
      { type: "goto", url: "https://example.com" },
      { type: "done", evidence: "heading visible" },
    ])
    expect(order[0]).toBe("end-then-wake")
    expect(plan.plans).toBe(1)
    expect(plan.reviews).toBe(1)
    expect(computer.calls).toContain("goto")
    expect(loop.mission?.status).toBe("done")
  })

  it("asks on a level 1 commit and does not click", async () => {
    const { loop, computer, plan } = await run(1, [{ type: "click", x: 4, y: 5, commit: true }])
    expect(plan.reviews).toBe(1)
    expect(computer.calls.filter((call) => call.startsWith("click"))).toEqual([])
    expect(loop.mission?.status).toBe("waiting_on_user")
  })

  it("does not click a second commit", async () => {
    const { computer } = await run(2, [
      { type: "click", x: 1, y: 1, commit: true },
      { type: "click", x: 2, y: 2, commit: true },
    ])
    expect(computer.calls.filter((call) => call.startsWith("click"))).toEqual(["click:1,1"])
  })

  it("queues a second mission while the first is waiting", async () => {
    const { loop } = await run(2, [{ type: "ask", question: "Which account?", reason: "fact" }])
    await loop.acceptMission("second mission")
    expect(loop.mission?.request).toBe("Open the site and stop when the heading is visible")
    expect(loop.queue).toEqual(["second mission"])
  })

  it("asks the user after a second replan", async () => {
    const { loop } = await run(
      2,
      [
        { type: "click", x: 1, y: 1, commit: true },
        { type: "click", x: 1, y: 1, commit: true },
      ],
      [
        { type: "replan", steps: [step()] },
        { type: "replan", steps: [step()] },
      ],
    )
    expect(loop.mission?.status).toBe("waiting_on_user")
    expect(loop.mission?.questionReason).toBe("verify")
  })
})
