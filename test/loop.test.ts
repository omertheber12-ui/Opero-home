import { describe, expect, it } from "vitest"
import { HouseLoop, type LoopEvent } from "../src/agent/loop.js"
import { createStatusBoard, type StatusBoard } from "../src/agent/work-status.js"
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

async function run(
  level: 1 | 2,
  actions: AgentAction[],
  reviews: Verdict[] = [],
  options: { pageTextAfterGoto?: string; events?: LoopEvent[]; status?: StatusBoard } = {},
) {
  const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
  const computer = new FakeComputer(dir)
  computer.text = ""
  computer.controls = [{ ref: 1, role: "button", name: "Go" }]
  const pageTextAfterGoto = options.pageTextAfterGoto ?? "heading visible"
  const plan = planner(reviews)
  const order: string[] = []
  const loop = new HouseLoop({
    planner: plan,
    executor: executor(actions),
    computer,
    vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
    level,
    language: "en",
    status: options.status,
    emit: (event) => options.events?.push(event),
  })
  const wake = computer.wake.bind(computer)
  computer.wake = async () => {
    order.push(loop.mission?.end ? "end-then-wake" : "wake-before-end")
    await wake()
  }
  const goto = computer.goto.bind(computer)
  computer.goto = async (url: string) => {
    await goto(url)
    computer.text = pageTextAfterGoto
  }
  await loop.acceptMission("Open the site and stop when the heading is visible")
  return { loop, computer, plan, order }
}

describe("mission loop", () => {
  it("saves the end before Chrome wakes, then finishes when the heading is visible", async () => {
    const { loop, computer, plan, order } = await run(2, [
      { type: "goto", url: "https://example.com" },
      { type: "done", evidence: "heading visible" },
    ])
    expect(order[0]).toBe("end-then-wake")
    expect(plan.plans).toBe(1)
    expect(computer.calls).toContain("goto")
    expect(loop.mission?.status).toBe("done")
  })

  it("asks on a level 1 commit and does not click", async () => {
    const { loop, computer, plan } = await run(
      1,
      [{ type: "click", ref: 1, commit: true }],
      [],
      { pageTextAfterGoto: "welcome" },
    )
    expect(plan.reviews).toBe(0)
    expect(computer.calls.filter((call) => call.startsWith("clickRef"))).toEqual([])
    expect(loop.mission?.status).toBe("waiting_on_user")
  })

  it("does not click a second commit", async () => {
    const { computer } = await run(
      2,
      [
        { type: "click", ref: 1, commit: true },
        { type: "click", ref: 1, commit: true },
      ],
      [],
      { pageTextAfterGoto: "welcome" },
    )
    expect(computer.calls.filter((call) => call.startsWith("clickRef"))).toEqual(["clickRef:1"])
  })

  it("clicks a named control and types one character at a time", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = "search page"
    computer.currentUrl = "https://news.example/search"
    computer.controls = [
      { ref: 4, role: "textbox", name: "Search" },
      { ref: 12, role: "link", name: "Israel Iran latest" },
    ]
    const events: LoopEvent[] = []
    const newsPlan: Planner = {
      async plan() {
        return {
          end: "dated headlines copied from the page",
          steps: [{ ...step(), site: "https://news.example/search", doneWhen: "Israel Iran latest" }],
        }
      },
      async review() {
        return { type: "approve" }
      },
    }
    const loop = new HouseLoop({
      planner: newsPlan,
      executor: executor([
        { type: "type", ref: 4, text: "war", commit: false },
        { type: "click", ref: 12, commit: false },
        { type: "done", evidence: "Israel Iran latest" },
      ]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    computer.goto = async () => undefined
    const clickRef = computer.clickRef.bind(computer)
    computer.clickRef = async (ref: number) => {
      await clickRef(ref)
      computer.text = "Israel Iran latest"
    }
    await loop.acceptMission("Fetch latest Israel Iran news")
    expect(computer.calls).toContain("typeRef:4")
    expect(computer.calls).toContain("clickRef:12")
    expect(computer.typedChars).toEqual(["w", "a", "r"])
    expect(loop.mission?.status).toBe("done")
    expect(events.some((event) => event.type === "message" && event.role === "agent" && event.text === "Israel Iran latest")).toBe(true)
  })

  it("retries a paraphrased done once instead of asking the user", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = "Israel and Iran ceasefire talks resume today"
    computer.currentUrl = "https://news.example"
    computer.controls = [{ ref: 1, role: "link", name: "Story" }]
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return {
            end: "dated headlines copied from the page",
            steps: [{ ...step(), doneWhen: "facts copied into chat", site: "https://news.example" }],
          }
        },
        async review() {
          return { type: "approve" }
        },
      },
      executor: executor([
        { type: "done", evidence: "Talks between the countries are underway" },
        { type: "done", evidence: "Israel and Iran ceasefire talks resume today" },
      ]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    await loop.acceptMission("news")
    expect(loop.mission?.status).toBe("done")
    expect(loop.mission?.questionReason).toBeNull()
  })

  it("finishes a paraphrased done with page-grounded headlines and does not ask", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text =
      "Skip to main content\nIsrael and Iran tensions rise after overnight strikes\nQatar hosts talks on Iran nuclear file\nSubscribe now"
    computer.currentUrl = "https://news.example"
    computer.controls = [{ ref: 3, role: "link", name: "Middle East" }]
    const events: LoopEvent[] = []
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return {
            end: "dated headlines about the Israel-Iran war copied from the page",
            steps: [{ ...step(), doneWhen: "facts in chat", site: "https://news.example" }],
          }
        },
        async review() {
          return { type: "approve" }
        },
      },
      executor: executor([
        {
          type: "done",
          evidence: "Latest Israel-Iran war headlines from Reuters Middle East coverage today.",
        },
      ]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    await loop.acceptMission("Fetch the latest Israel Iran war news")
    expect(loop.mission?.status).toBe("done")
    expect(loop.mission?.questionReason).toBeNull()
    const agent = events.find((event) => event.type === "message" && event.role === "agent")
    expect(agent && agent.type === "message" ? agent.text : "").toContain("Israel and Iran tensions")
    expect(agent && agent.type === "message" ? agent.text : "").not.toContain("Latest Israel-Iran")
  })

  it("nudges browse then copy before asking when done stays ungrounded with controls", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = "Recipes for summer pasta\nHow to bake sourdough bread at home this weekend"
    computer.currentUrl = "https://food.example"
    computer.controls = [{ ref: 2, role: "link", name: "More recipes" }]
    const notesSeen: string[] = []
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return {
            end: "dated war headlines copied from the page",
            steps: [{ ...step(), doneWhen: "facts in chat", site: "https://food.example" }],
          }
        },
        async review() {
          return { type: "approve" }
        },
      },
      executor: {
        async next(input) {
          notesSeen.push(...input.notes)
          return {
            type: "done",
            evidence: "Latest Israel-Iran war headlines rewritten from memory.",
          }
        },
      },
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    await loop.acceptMission("Fetch the latest Israel Iran war news")
    expect(loop.mission?.status).toBe("waiting_on_user")
    expect(loop.mission?.questionReason).toBe("verify")
    expect(notesSeen.some((note) => note.includes("Click or scroll"))).toBe(true)
    expect(notesSeen.some((note) => note.includes("Copy headline lines"))).toBe(true)
  })

  it("queues a second mission while the first is waiting", async () => {
    const { loop } = await run(2, [{ type: "ask", question: "Which account?", reason: "fact" }], [], {
      pageTextAfterGoto: "welcome",
    })
    await loop.acceptMission("second mission")
    expect(loop.mission?.request).toBe("Open the site and stop when the heading is visible")
    expect(loop.queue).toEqual(["second mission"])
  })

  it("asks the user after a second replan", async () => {
    const same = { type: "click" as const, ref: 1, commit: false }
    const { loop } = await run(
      2,
      [same, same, same],
      [
        { type: "replan", steps: [step()] },
        { type: "replan", steps: [step()] },
      ],
      { pageTextAfterGoto: "welcome" },
    )
    expect(loop.mission?.status).toBe("waiting_on_user")
    expect(loop.mission?.questionReason).toBe("verify")
  })

  it("finishes when the end text is already on the page after goto", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const page = new FakeComputer(dir)
    page.text = ""
    page.currentUrl = "about:blank"
    page.controls = [{ ref: 1, role: "button", name: "Go" }]
    const plan = planner([])
    const events: string[] = []
    const auto = new HouseLoop({
      planner: plan,
      executor: executor([{ type: "ask", question: "stuck?", reason: "verify" }]),
      computer: page,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => {
        if (event.type === "status") events.push(event.status)
      },
    })
    const goto = page.goto.bind(page)
    page.goto = async (url: string) => {
      await goto(url)
      page.text = "heading visible"
    }
    await auto.acceptMission("Open the site and stop when the heading is visible")
    expect(auto.mission?.status).toBe("done")
    expect(events).toContain("done")
  })

  it("rejects an empty replan and keeps the original steps", async () => {
    const empty: Step = {
      id: "bad",
      text: "",
      site: "",
      doneWhen: "",
      commit: false,
      status: "pending",
      pause: false,
      userPause: false,
    }
    const same = { type: "click" as const, ref: 1, commit: false }
    const { loop } = await run(2, [same, same], [{ type: "replan", steps: [empty] }], {
      pageTextAfterGoto: "welcome",
    })
    expect(loop.mission?.status).toBe("waiting_on_user")
    expect(loop.mission?.questionReason).toBe("fact")
    expect(loop.mission?.steps[0]?.site).toBe("https://example.com")
    expect(loop.mission?.steps[0]?.text).toBe("Open the site and read the heading")
  })

  it("blocks when the planner throws so a later mission can start", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = ""
    const failing: Planner = {
      async plan() {
        throw new Error("planner offline")
      },
      async review() {
        return { type: "approve" }
      },
    }
    const loop = new HouseLoop({
      planner: failing,
      executor: executor([]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    await loop.acceptMission("first")
    expect(loop.mission?.status).toBe("blocked")
    const page = new FakeComputer(dir)
    page.text = ""
    page.controls = [{ ref: 1, role: "button", name: "Go" }]
    const goto = page.goto.bind(page)
    page.goto = async (url: string) => {
      await goto(url)
      page.text = "heading visible"
    }
    const second = new HouseLoop({
      planner: planner([]),
      executor: executor([{ type: "ask", question: "no", reason: "verify" }]),
      computer: page,
      vault: new Vault(join(dir, "vault2.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    await second.acceptMission("second")
    expect(second.mission?.request).toBe("second")
    expect(second.mission?.status).toBe("done")
  })

  it("hands the screen to the user when Google asks for a person", async () => {
    const events: LoopEvent[] = []
    const { loop } = await run(1, [{ type: "click", ref: 1 }], [], {
      pageTextAfterGoto: "Our systems have detected unusual traffic from your computer network",
      events,
    })
    expect(loop.driver).toBe("user")
    expect(loop.mission?.status).toBe("running")
    expect(events.some((event) => event.type === "message" && event.text.includes("live view"))).toBe(true)
    expect(events.some((event) => event.type === "thinking" && event.text.includes("Bot check"))).toBe(true)
    expect(events.some((event) => event.type === "driver" && event.driver === "user")).toBe(true)
  })

  it("hands the browser over on a security verification page before the next click", async () => {
    const events: LoopEvent[] = []
    const status = createStatusBoard()
    const { loop, computer } = await run(2, [{ type: "click", ref: 1, commit: false }], [], {
      pageTextAfterGoto: "Performing security verification",
      events,
      status,
    })
    expect(loop.driver).toBe("user")
    expect(computer.calls.filter((call) => call.startsWith("clickRef"))).toEqual([])
    expect(events.some((event) => event.type === "message" && event.text.includes("https://live.example/view"))).toBe(true)
    expect(status.get()?.challenge).toBe(true)
    expect(status.get()?.phase).toBe("challenge")
  })

  it("keeps driving when the page only says it is loading", async () => {
    const { loop, computer } = await run(2, [{ type: "click", ref: 1, commit: false }], [], {
      pageTextAfterGoto: "Just a moment…",
    })
    expect(loop.driver).toBe("agent")
    expect(computer.calls.some((call) => call.startsWith("clickRef"))).toBe(true)
  })

  it("does not click after the user takes control during the model call", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = ""
    computer.controls = [{ ref: 1, role: "button", name: "Go" }]
    const loop = new HouseLoop({
      planner: planner([]),
      executor: {
        async next() {
          loop.setDriver("user")
          return { type: "click", ref: 1, commit: false }
        },
      },
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    const goto = computer.goto.bind(computer)
    computer.goto = async (url: string) => {
      await goto(url)
      computer.text = "welcome"
    }
    await loop.acceptMission("Open the site and stop when the heading is visible")
    expect(loop.driver).toBe("user")
    expect(computer.calls.filter((call) => call.startsWith("clickRef"))).toEqual([])
  })
})
