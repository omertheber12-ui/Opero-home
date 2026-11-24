import { describe, expect, it } from "vitest"
import { HouseLoop, type LoopEvent } from "../src/agent/loop.js"
import { createStatusBoard, type StatusBoard } from "../src/agent/work-status.js"
import type { Executor } from "../src/agent/executor.js"
import type { Planner } from "../src/agent/planner.js"
import { FakeComputer } from "../src/computer/computer.js"
import {
  CHALLENGE_ATTEMPT_LIMIT,
  COMPUTER_DID_NOT_WAKE,
  MISSION_ABORTED_FOR_NEW,
  MISSION_ABORTED_QUIET,
  MISSION_ABORT_MS,
  ON_IT_MESSAGE,
  STALL_ACTIONS,
  THINKING_PROGRESS,
  THINKING_READING,
  THINKING_REVIEWING,
} from "../src/config.js"
import { createTraceWriter } from "../src/domain/trace.js"
import { blankMission } from "../src/domain/mission.js"
import type { AgentAction, Mission, Step, Verdict } from "../src/domain/types.js"
import { Vault, loadKey } from "../src/vault/vault.js"
import { randomBytes } from "node:crypto"
import { mkdtemp, readFile } from "node:fs/promises"
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

function blankMissionLike(): Mission {
  return {
    ...blankMission("m1", "Open the site and stop when the heading is visible", 2),
    end: "heading visible",
    status: "running",
    steps: [step()],
  }
}

function planner(reviewQueue: Verdict[]): Planner & { plans: number; reviews: number } {
  return {
    plans: 0,
    reviews: 0,
    async plan() {
      this.plans += 1
      return { type: "plan" as const, end: "heading visible", outcome: "read" as const, steps: [step()] }
    },
    async review() {
      this.reviews += 1
      return reviewQueue.shift() ?? { type: "approve" }
    },
    async converse() {
      return { type: "reply" as const, text: "stub" }
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
  options: {
    pageTextAfterGoto?: string
    events?: LoopEvent[]
    status?: StatusBoard
    onClick?: (computer: FakeComputer) => void
  } = {},
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
  const clickRef = computer.clickRef.bind(computer)
  computer.clickRef = async (ref: number) => {
    await clickRef(ref)
    options.onClick?.(computer)
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
          type: "plan",
          end: "dated headlines copied from the page",
          outcome: "read",
          steps: [{ ...step(), site: "https://news.example/search", doneWhen: "Israel Iran latest" }],
        }
      },
      async review() {
        return { type: "approve" }
      },
      async converse() {
        return { type: "reply" as const, text: "stub" }
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
            type: "plan",
            end: "dated headlines copied from the page",
            outcome: "read",
            steps: [{ ...step(), doneWhen: "facts copied into chat", site: "https://news.example" }],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply" as const, text: "stub" }
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
            type: "plan",
            end: "dated headlines about the Israel-Iran war copied from the page",
            outcome: "read",
            steps: [{ ...step(), doneWhen: "facts in chat", site: "https://news.example" }],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply" as const, text: "stub" }
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
    const agent = events.find(
      (event) => event.type === "message" && event.role === "agent" && event.text.includes("Israel and Iran tensions"),
    )
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
            type: "plan",
            end: "dated war headlines copied from the page",
            outcome: "read",
            steps: [{ ...step(), doneWhen: "facts in chat", site: "https://food.example" }],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply" as const, text: "stub" }
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

  it("puts a newer mission at the front while the current one keeps running", async () => {
    const events: LoopEvent[] = []
    const { loop } = await run(2, [{ type: "ask", question: "Which account?", reason: "fact" }], [], {
      pageTextAfterGoto: "welcome",
      events,
    })
    expect(loop.mission?.status).toBe("waiting_on_user")
    let heard = ""
    loop.setBrain(
      {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse(input) {
          heard = input.message
          return { type: "reply", text: "Use the second account." }
        },
      },
      executor([]),
    )
    await loop.acceptMission("the second account")
    expect(heard).toBe("the second account")
    expect(loop.queue).toEqual([])
    expect(loop.mission?.end).toBe("heading visible")
  })

  it("starts a newer mission immediately and aborts the previous one", async () => {
    const events: LoopEvent[] = []
    const { loop } = await run(2, [{ type: "click", ref: 1 }], [], {
      pageTextAfterGoto: "Performing security verification",
      events,
    })
    const requests: string[] = []
    loop.setBrain(
      {
        async plan({ request }) {
          requests.push(request)
          return {
            type: "plan",
            end: "heading visible",
            outcome: "read",
            steps: [step()],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "start" }
        },
      },
      executor([{ type: "done", evidence: "heading visible" }]),
    )
    await loop.acceptMission("newest waiting")
    expect(requests[0]).toBe("newest waiting")
    expect(loop.queue).toEqual([])
    expect(events.some((event) => event.type === "message" && event.text === MISSION_ABORTED_FOR_NEW)).toBe(true)
    expect(loop.mission?.request).toBe("newest waiting")
  })

  it("asks a clarifying question before writing a plan or waking the browser", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    const events: LoopEvent[] = []
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "ask", question: "Which city should I book?" }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply", text: "stub" }
        },
      },
      executor: executor([]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    await loop.acceptMission("Book a defensive driving course")
    expect(computer.calls).not.toContain("wake")
    expect(loop.mission?.status).toBe("waiting_on_user")
    expect(loop.mission?.question).toBe("Which city should I book?")
    expect(events.some((event) => event.type === "question" && event.question === "Which city should I book?")).toBe(true)
  })

  it("sends the saved thread on a clarify follow-up, not only the latest line", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const thread: Array<{ role: "user" | "agent"; text: string }> = []
    const plans: Array<{ request: string; thread: Array<{ role: "user" | "agent"; text: string }> }> = []
    const loop = new HouseLoop({
      planner: {
        async plan(input) {
          plans.push({ request: input.request, thread: [...(input.thread ?? [])] })
          if (plans.length === 1) return { type: "ask", question: "Which city should I book?" }
          return {
            type: "plan",
            end: "appointment booked",
            outcome: "navigate",
            steps: [step()],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply", text: "stub" }
        },
      },
      executor: executor([{ type: "done", evidence: "heading visible" }]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      recentThread: () => [...thread],
      emit: (event) => {
        if (event.type === "message") thread.push({ role: event.role, text: event.text })
        if (event.type === "question") thread.push({ role: "agent", text: event.question })
      },
    })
    await loop.acceptMission("Book a defensive driving course")
    await loop.acceptMission("Tel Aviv")
    expect(plans).toHaveLength(2)
    expect(plans[0]?.request).toBe("Book a defensive driving course")
    expect(plans[1]?.request).toBe("Book a defensive driving course")
    expect(plans[1]?.thread).toEqual([
      { role: "user", text: "Book a defensive driving course" },
      { role: "agent", text: "Which city should I book?" },
      { role: "user", text: "Tel Aviv" },
    ])
    expect(plans[1]?.request.includes("User guidance")).toBe(false)
  })

  it("asks the user after too many replans", async () => {
    const same = { type: "click" as const, ref: 1, commit: false }
    const { loop } = await run(
      2,
      [same, same, same, same, same],
      [
        { type: "replan", steps: [step()] },
        { type: "replan", steps: [step()] },
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
      async converse() {
        return { type: "reply" as const, text: "stub" }
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

  it("clicks a Google human check while the agent is still driving", async () => {
    const events: LoopEvent[] = []
    const { loop, computer } = await run(
      2,
      Array.from({ length: CHALLENGE_ATTEMPT_LIMIT }, () => ({ type: "click" as const, ref: 1, commit: false })),
      [],
      {
        pageTextAfterGoto: "Our systems have detected unusual traffic from your computer network",
        events,
      },
    )
    const clicks = computer.calls.filter((call) => call.startsWith("clickRef"))
    expect(clicks).toHaveLength(CHALLENGE_ATTEMPT_LIMIT)
    expect(loop.driver).toBe("user")
    expect(loop.mission?.status).toBe("running")
    expect(events.some((event) => event.type === "thinking" && event.text.includes("Trying"))).toBe(true)
    expect(events.some((event) => event.type === "message" && event.text.includes("https://live.example/view"))).toBe(true)
    expect(events.some((event) => event.type === "driver" && event.driver === "user")).toBe(true)
    const trying = events.findIndex((event) => event.type === "thinking" && event.text.includes("Trying"))
    const handoff = events.findIndex((event) => event.type === "message" && event.text.includes("live view"))
    expect(trying).toBeGreaterThanOrEqual(0)
    expect(handoff).toBeGreaterThan(trying)
  })

  it("hands the browser over only after the security check is still there", async () => {
    const events: LoopEvent[] = []
    const status = createStatusBoard()
    const { loop, computer } = await run(
      2,
      Array.from({ length: CHALLENGE_ATTEMPT_LIMIT + 1 }, () => ({ type: "click" as const, ref: 1, commit: false })),
      [],
      {
        pageTextAfterGoto: "Performing security verification",
        events,
        status,
      },
    )
    expect(loop.driver).toBe("user")
    expect(computer.calls.filter((call) => call.startsWith("clickRef"))).toHaveLength(CHALLENGE_ATTEMPT_LIMIT)
    expect(events.some((event) => event.type === "message" && event.text.includes("https://live.example/view"))).toBe(true)
    expect(status.get()?.challenge).toBe(true)
    expect(status.get()?.phase).toBe("challenge")
  })

  it("does not ask about a stalled strategy after handing over the check", async () => {
    const events: LoopEvent[] = []
    const status = createStatusBoard()
    const { loop, plan } = await run(
      2,
      Array.from({ length: CHALLENGE_ATTEMPT_LIMIT + 1 }, () => ({ type: "click" as const, ref: 1, commit: false })),
      [],
      {
        pageTextAfterGoto: "Performing security verification",
        events,
        status,
      },
    )
    expect(loop.driver).toBe("user")
    expect(loop.mission?.status).toBe("running")
    expect(status.get()?.challenge).toBe(true)
    expect(status.get()?.stagnantActions ?? 0).toBeGreaterThanOrEqual(STALL_ACTIONS)
    const before = events.length
    await loop.supervise()
    expect(loop.mission?.status).toBe("running")
    expect(loop.mission?.question).toBeNull()
    expect(events.slice(before).some((event) => event.type === "question")).toBe(false)
    expect(plan.reviews).toBe(0)
  })

  it("continues the mission when the human check clears", async () => {
    const events: LoopEvent[] = []
    const { loop, computer } = await run(
      2,
      [
        { type: "click", ref: 1, commit: false },
        { type: "done", evidence: "heading visible" },
      ],
      [],
      {
        pageTextAfterGoto: "Performing security verification",
        events,
        onClick: (page) => {
          page.text = "heading visible"
        },
      },
    )
    expect(loop.driver).toBe("agent")
    expect(loop.mission?.status).toBe("done")
    expect(computer.calls.some((call) => call.startsWith("clickRef"))).toBe(true)
    expect(events.some((event) => event.type === "message" && event.text.includes("live view"))).toBe(false)
  })

  it("keeps driving when the page only says it is loading", async () => {
    const { loop, computer } = await run(2, [{ type: "click", ref: 1, commit: false }], [], {
      pageTextAfterGoto: "Just a moment…",
    })
    expect(loop.driver).toBe("agent")
    expect(computer.calls.some((call) => call.startsWith("clickRef"))).toBe(true)
  })

  it("does not finish a payment from wording alone", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = "Payment confirmed\nThank you for your purchase"
    computer.currentUrl = "https://shop.example/done"
    computer.controls = [{ ref: 1, role: "button", name: "Done" }]
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return {
            type: "plan",
            end: "Payment confirmed",
            outcome: "transact",
            steps: [{ ...step(), site: "https://shop.example", doneWhen: "Payment confirmed", commit: true }],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply" as const, text: "stub" }
        },
      },
      executor: executor([{ type: "done", evidence: "Payment confirmed" }]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    await loop.acceptMission("Pay the electricity bill")
    expect(loop.mission?.status).toBe("waiting_on_user")
    expect(loop.mission?.outcome).toBe("transact")
  })

  it("asks on a Pay button even when the actor sets commit false", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = "checkout"
    computer.currentUrl = "https://shop.example/pay"
    computer.controls = [{ ref: 1, role: "button", name: "Pay" }]
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return {
            type: "plan",
            end: "Order number visible",
            outcome: "transact",
            steps: [{ ...step(), site: "https://shop.example", doneWhen: "Order number", commit: true }],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply" as const, text: "stub" }
        },
      },
      executor: executor([{ type: "click", ref: 1, commit: false }]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 1,
      language: "en",
      emit: () => undefined,
    })
    await loop.acceptMission("Pay the bill")
    expect(computer.calls.filter((call) => call.startsWith("clickRef"))).toEqual([])
    expect(loop.mission?.status).toBe("waiting_on_user")
    expect(loop.mission?.questionReason).toBe("commit")
    expect(loop.mission?.approval?.status).toBe("pending")
    let heard = ""
    loop.setBrain(
      {
        async plan() {
          return {
            type: "plan",
            end: "Order number visible",
            outcome: "transact",
            steps: [{ ...step(), site: "https://shop.example", doneWhen: "Order number", commit: true }],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse(input) {
          heard = input.message
          return { type: "reply", text: "I will not press Pay from this reply." }
        },
      },
      executor([]),
    )
    await loop.answer("yes")
    expect(heard).toBe("yes")
    expect(loop.mission?.approval?.status).not.toBe("granted")
    expect(computer.calls.filter((call) => call.startsWith("clickRef"))).toEqual([])
  })

  it("does not apply actions while a pending step is paused", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = ""
    computer.controls = [{ ref: 1, role: "button", name: "Go" }]
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return {
            type: "plan",
            end: "heading visible",
            outcome: "read",
            steps: [{ ...step(), pause: true, userPause: true }],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply" as const, text: "stub" }
        },
      },
      executor: executor([{ type: "goto", url: "https://example.com" }]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    await loop.acceptMission("Open the site")
    expect(computer.calls).not.toContain("goto")
    expect(loop.mission?.status).toBe("waiting_on_user")
  })

  it("reloads a mission after restart without replaying the last action", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = "welcome"
    computer.currentUrl = "https://example.com"
    computer.controls = [{ ref: 1, role: "button", name: "Pay" }]
    const loop = new HouseLoop({
      planner: planner([]),
      executor: executor([]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    loop.restoreMission({
      ...blankMissionLike(),
      status: "running",
      end: "heading visible",
      lastCommit: { fingerprint: "pay", outcome: "started" },
      steps: [step()],
    })
    await loop.reconcileAfterRestart()
    expect(computer.calls.filter((call) => call.startsWith("clickRef"))).toEqual([])
    expect(loop.mission?.lastCommit?.outcome).toBe("unknown")
    expect(loop.mission?.status).toBe("waiting_on_user")
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

  it("lets the planner answer during a person check instead of queueing", async () => {
    const events: LoopEvent[] = []
    const { loop } = await run(2, [{ type: "click", ref: 1 }], [], {
      pageTextAfterGoto: "Performing security verification",
      events,
    })
    let heard = ""
    loop.setBrain(
      {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse(input) {
          heard = input.message
          expect(input.personCheck).toBe(true)
          return { type: "reply", text: "Still waiting on the person check." }
        },
      },
      executor([]),
    )
    await loop.acceptMission("עדכון בבקשה")
    expect(heard).toBe("עדכון בבקשה")
    expect(loop.queue).toEqual([])
    expect(loop.driver).toBe("user")
    expect(loop.mission?.status).toBe("running")
    expect(events.some((event) => event.type === "message" && event.text.includes("I'll start this next"))).toBe(false)
    expect(events.some((event) => event.type === "message" && event.text === "Still waiting on the person check.")).toBe(true)
  })

  it("keeps the end when the planner replans from chat during a person check", async () => {
    const { loop } = await run(2, [{ type: "click", ref: 1 }], [], {
      pageTextAfterGoto: "Performing security verification",
    })
    loop.setBrain(
      {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return {
            type: "replan",
            text: "Updated the steps.",
            steps: [{ ...step(), text: "Open the booking page", doneWhen: "booking form" }],
          }
        },
      },
      executor([]),
    )
    await loop.acceptMission("use the booking page")
    expect(loop.mission?.end).toBe("heading visible")
    expect(loop.mission?.steps[0]?.text).toBe("Open the booking page")
    expect(loop.driver).toBe("user")
    expect(loop.queue).toEqual([])
  })

  it("resumes after the planner hears that the person check is finished", async () => {
    const events: LoopEvent[] = []
    const { loop, computer } = await run(2, [{ type: "click", ref: 1 }], [], {
      pageTextAfterGoto: "Performing security verification",
      events,
    })
    loop.setBrain(
      {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          computer.text = "heading visible"
          computer.currentUrl = "https://example.com"
          return { type: "resume", text: "Continuing." }
        },
      },
      executor([{ type: "done", evidence: "heading visible" }]),
    )
    await loop.acceptMission("I finished the check")
    expect(events.some((event) => event.type === "message" && event.text === "Continuing.")).toBe(true)
    expect(loop.driver).toBe("agent")
    expect(loop.mission?.status).toBe("done")
    expect(loop.queue).toEqual([])
  })

  it("does not queue when the planner cannot read the message", async () => {
    const events: LoopEvent[] = []
    const { loop } = await run(2, [{ type: "click", ref: 1 }], [], {
      pageTextAfterGoto: "Performing security verification",
      events,
    })
    loop.setBrain(
      {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          throw new Error("planner offline")
        },
      },
      executor([]),
    )
    await loop.acceptMission("עדכון בבקשה")
    expect(loop.queue).toEqual([])
    expect(loop.driver).toBe("user")
    expect(loop.mission?.status).toBe("running")
    expect(events.some((event) => event.type === "message" && event.text.includes("unchanged"))).toBe(true)
  })

  it("answers a mid-mission update after the current click, without queueing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = ""
    computer.controls = [{ ref: 1, role: "button", name: "Go" }]
    const events: LoopEvent[] = []
    const acts: string[] = []
    let loop: HouseLoop = undefined as unknown as HouseLoop
    loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply", text: "Still opening the page." }
        },
      },
      executor: {
        async next() {
          acts.push("act")
          if (acts.length === 1) {
            await loop.acceptMission("update please")
            return { type: "click", ref: 1, commit: false }
          }
          computer.text = "heading visible"
          return { type: "done", evidence: "heading visible" }
        },
      },
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    const goto = computer.goto.bind(computer)
    computer.goto = async (url: string) => {
      await goto(url)
      computer.text = "welcome"
    }
    await loop.acceptMission("Open the site and stop when the heading is visible")
    expect(acts.length).toBeGreaterThan(1)
    expect(loop.queue).toEqual([])
    expect(events.some((event) => event.type === "message" && event.text === "Still opening the page.")).toBe(true)
    expect(events.some((event) => event.type === "message" && event.text.includes("I'll start this next"))).toBe(false)
  })

  it("keeps a submit approval on the yes/no path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    computer.text = "checkout"
    computer.currentUrl = "https://shop.example/pay"
    computer.controls = [{ ref: 1, role: "button", name: "Pay" }]
    let askedPlanner = false
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return {
            type: "plan",
            end: "Order number visible",
            outcome: "transact",
            steps: [{ ...step(), site: "https://shop.example", doneWhen: "Order number", commit: true }],
          }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          askedPlanner = true
          return { type: "reply" as const, text: "I heard yes. I will not press Pay from this reply." }
        },
      },
      executor: executor([{ type: "click", ref: 1, commit: false }]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 1,
      language: "en",
      emit: () => undefined,
    })
    await loop.acceptMission("Pay the bill")
    expect(loop.mission?.questionReason).toBe("commit")
    await loop.acceptMission("yes")
    expect(askedPlanner).toBe(true)
    expect(loop.queue).toEqual([])
    expect(loop.mission?.approval?.status).not.toBe("granted")
  })

  it("gives a verify wait to the planner in Hebrew and English", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const events: LoopEvent[] = []
    const heard: string[] = []
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse(input) {
          heard.push(input.message)
          return { type: "reply", text: `Heard ${input.message}` }
        },
      },
      executor: executor([]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    loop.restoreMission({
      ...blankMissionLike(),
      status: "waiting_on_user",
      question: "I stopped after many actions without reaching the end.",
      questionReason: "verify",
    })
    await loop.acceptMission("מה המצב")
    await loop.acceptMission("What is happening?")
    expect(heard).toEqual(["מה המצב", "What is happening?"])
    expect(loop.mission?.end).toBe("heading visible")
    expect(loop.mission?.steps[0]?.text).toBe(step().text)
    expect(events.some((event) => event.type === "message" && event.text === "Heard מה המצב")).toBe(true)
    expect(events.some((event) => event.type === "message" && event.text === "Heard What is happening?")).toBe(true)
  })

  it("starts a different mission immediately and aborts the previous plan", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const events: LoopEvent[] = []
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "plan", end: "new heading", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "start" }
        },
      },
      executor: executor([{ type: "done", evidence: "new heading" }]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    loop.restoreMission({ ...blankMissionLike(), status: "waiting_on_user", questionReason: "verify" })
    await loop.acceptMission("Open example.com and copy the heading. This is a different mission.")
    expect(events.some((event) => event.type === "message" && event.text === MISSION_ABORTED_FOR_NEW)).toBe(true)
    expect(events.some((event) => event.type === "status" && event.status === "aborted")).toBe(true)
    expect(loop.queue).toEqual([])
    expect(loop.mission?.request).toBe("Open example.com and copy the heading. This is a different mission.")
    expect(loop.mission?.end).toBe("new heading")
  })

  it("replans upcoming steps from a verify wait and keeps the end", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return {
            type: "replan",
            text: "Updated the steps.",
            steps: [{ ...step(), text: "Open the booking page", doneWhen: "booking form" }],
          }
        },
      },
      executor: executor([]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    loop.restoreMission({ ...blankMissionLike(), status: "waiting_on_user", questionReason: "verify" })
    loop.setDriver("user")
    await loop.acceptMission("Try the booking page")
    expect(loop.mission?.end).toBe("heading visible")
    expect(loop.mission?.steps[0]?.text).toBe("Open the booking page")
  })

  it("narrates before a stalled rescue and marks the trace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const events: LoopEvent[] = []
    const board = createStatusBoard()
    let reviews = 0
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          reviews += 1
          return { type: "stop", question: "How should I continue?" }
        },
        async converse() {
          return { type: "reply", text: "no" }
        },
      },
      executor: executor([]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      status: board,
      trace: createTraceWriter(dir),
      emit: (event) => events.push(event),
    })
    loop.restoreMission({ ...blankMissionLike(), stagnantActions: STALL_ACTIONS })
    board.set({
      missionId: "m1",
      phase: "browsing",
      stepHint: "Open the site",
      lastAction: "click",
      challenge: false,
      updatedAt: 1,
      detail: "stuck",
      stagnantActions: STALL_ACTIONS,
    })
    await loop.supervise()
    await loop.supervise()
    expect(reviews).toBe(1)
    const thinkingAt = events.findIndex((event) => event.type === "thinking" && event.text === THINKING_REVIEWING)
    const questionAt = events.findIndex((event) => event.type === "question")
    expect(thinkingAt).toBeGreaterThanOrEqual(0)
    expect(questionAt).toBeGreaterThan(thinkingAt)
    const text = await readFile(join(dir, "traces", "m1.jsonl"), "utf8")
    const lines = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { kind: string; class?: string })
    const marked = lines.filter((line) => line.kind === "rescue" || line.kind === "ask")
    expect(marked.length).toBeGreaterThan(0)
    expect(marked.every((line) => line.class === "site" || line.class === "reasoning")).toBe(true)
  })

  it("wakes a closed computer before the planner reads a later line", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const computer = new FakeComputer(dir)
    let heard = ""
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "ask", question: "Which city?" }
        },
        async review() {
          return { type: "approve" }
        },
        async converse(input) {
          heard = input.message
          return { type: "reply", text: "Still on the heading." }
        },
      },
      executor: executor([]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: () => undefined,
    })
    loop.restoreMission({
      ...blankMissionLike(),
      status: "waiting_on_user",
      question: "I stopped after many actions without reaching the end.",
      questionReason: "verify",
    })
    await computer.close()
    await loop.acceptMission("מה קורה")
    expect(computer.calls).toContain("wake")
    expect(heard).toBe("מה קורה")
    expect(loop.mission?.end).toBe("heading visible")
  })

  it("answers a waiting line when the budget is already spent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const events: LoopEvent[] = []
    const heard: string[] = []
    const sentence = "Answer this sentence only by repeating the word lighthouse."
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "ask", question: "Which city?" }
        },
        async review() {
          return { type: "stop", question: "How should I continue?" }
        },
        async converse(input) {
          heard.push(input.message)
          return { type: "reply", text: `Heard ${input.message}` }
        },
      },
      executor: executor([]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    const mission = blankMissionLike()
    loop.restoreMission({
      ...mission,
      status: "waiting_on_user",
      question: "I stopped after many actions without reaching the end.",
      questionReason: "verify",
      modelCalls: mission.budget,
    })
    await loop.acceptMission(sentence)
    const readingAt = events.findIndex((event) => event.type === "thinking" && event.text === THINKING_READING)
    const replyAt = events.findIndex((event) => event.type === "message" && event.text === `Heard ${sentence}`)
    expect(heard).toEqual([sentence])
    expect(readingAt).toBeGreaterThanOrEqual(0)
    expect(replyAt).toBeGreaterThan(readingAt)
    expect(events.some((event) => event.type === "question")).toBe(false)
    expect(loop.mission?.end).toBe("heading visible")
    expect(loop.mission?.steps[0]?.text).toBe(step().text)
    expect(loop.mission?.status).toBe("waiting_on_user")
  })

  it("does not budget-rescue a guide when the budget is already spent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const events: LoopEvent[] = []
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "ask", question: "Which city?" }
        },
        async review() {
          return { type: "stop", question: "How should I continue?" }
        },
        async converse() {
          return { type: "guide", text: "Stay on this page.", note: "read the heading" }
        },
      },
      executor: executor([]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    const mission = blankMissionLike()
    loop.restoreMission({
      ...mission,
      status: "waiting_on_user",
      questionReason: "verify",
      modelCalls: mission.budget,
    })
    await loop.acceptMission("Keep going on this mission.")
    expect(events.some((event) => event.type === "message" && event.text === "Stay on this page.")).toBe(true)
    expect(events.some((event) => event.type === "question")).toBe(false)
    expect(loop.mission?.end).toBe("heading visible")
    expect(loop.mission?.steps[0]?.text).toBe(step().text)
    expect(loop.mission?.status).toBe("waiting_on_user")
  })

  it("replans upcoming steps on a spent budget without asking again", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const events: LoopEvent[] = []
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "ask", question: "Which city?" }
        },
        async review() {
          return { type: "stop", question: "How should I continue?" }
        },
        async converse() {
          return {
            type: "replan",
            text: "Updated the steps.",
            steps: [{ ...step(), text: "Copy the page heading", doneWhen: "heading visible" }],
          }
        },
      },
      executor: executor([]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    const mission = blankMissionLike()
    loop.restoreMission({
      ...mission,
      status: "waiting_on_user",
      questionReason: "verify",
      modelCalls: mission.budget,
    })
    await loop.acceptMission("Replace the upcoming steps with one step that only copies the page heading.")
    expect(events.some((event) => event.type === "question")).toBe(false)
    expect(loop.mission?.end).toBe("heading visible")
    expect(loop.mission?.steps[0]?.text).toBe("Copy the page heading")
    expect(loop.mission?.status).toBe("waiting_on_user")
  })

  it("starts a different mission when the budget is already spent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const events: LoopEvent[] = []
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "plan", end: "main heading", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "stop", question: "How should I continue?" }
        },
        async converse() {
          return { type: "start" }
        },
      },
      executor: executor([{ type: "done", evidence: "main heading" }]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    const mission = blankMissionLike()
    loop.restoreMission({
      ...mission,
      status: "waiting_on_user",
      questionReason: "verify",
      modelCalls: mission.budget,
    })
    await loop.acceptMission("This is a different mission. Open https://example.com and tell me the main heading.")
    expect(events.some((event) => event.type === "message" && event.text === MISSION_ABORTED_FOR_NEW)).toBe(true)
    expect(loop.mission?.request).toBe(
      "This is a different mission. Open https://example.com and tell me the main heading.",
    )
    expect(loop.mission?.end).toBe("main heading")
  })

  it("aborts a quiet mission so the next request can start", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const events: LoopEvent[] = []
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "plan", end: "heading visible", outcome: "read", steps: [step()] }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply", text: "still here" }
        },
      },
      executor: executor([{ type: "done", evidence: "heading visible" }]),
      computer: new FakeComputer(dir),
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    loop.restoreMission(
      { ...blankMissionLike(), status: "waiting_on_user", questionReason: "verify" },
      { lastActivityMs: Date.now() - MISSION_ABORT_MS - 1 },
    )
    expect(loop.abortIfQuiet()).toBe(true)
    expect(loop.mission?.status).toBe("aborted")
    expect(events.some((event) => event.type === "message" && event.text === MISSION_ABORTED_QUIET)).toBe(true)
    await loop.acceptMission("Fresh mission after quiet abort")
    expect(loop.mission?.request).toBe("Fresh mission after quiet abort")
  })

  it("posts a progress line when a turn with budget remaining starts", async () => {
    const events: LoopEvent[] = []
    await run(
      2,
      [
        { type: "goto", url: "https://example.com" },
        { type: "done", evidence: "heading visible" },
      ],
      [],
      { events, pageTextAfterGoto: "heading visible" },
    )
    expect(events.some((event) => event.type === "thinking" && event.text === THINKING_PROGRESS)).toBe(true)
  })

  it("says the computer did not wake and still answers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-loop-"))
    const events: LoopEvent[] = []
    const computer = new FakeComputer(dir)
    computer.wake = async () => {
      throw new Error("session gone")
    }
    const loop = new HouseLoop({
      planner: {
        async plan() {
          return { type: "ask", question: "Which city?" }
        },
        async review() {
          return { type: "approve" }
        },
        async converse() {
          return { type: "reply", text: "lighthouse" }
        },
      },
      executor: executor([]),
      computer,
      vault: new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64"))),
      level: 2,
      language: "en",
      emit: (event) => events.push(event),
    })
    loop.restoreMission({
      ...blankMissionLike(),
      status: "waiting_on_user",
      questionReason: "verify",
    })
    await loop.acceptMission("Repeat the word lighthouse.")
    const wakeAt = events.findIndex(
      (event) => event.type === "message" && event.text.startsWith(COMPUTER_DID_NOT_WAKE),
    )
    const replyAt = events.findIndex((event) => event.type === "message" && event.text === "lighthouse")
    expect(wakeAt).toBeGreaterThanOrEqual(0)
    expect(replyAt).toBeGreaterThan(wakeAt)
    expect(loop.mission?.end).toBe("heading visible")
  })

  it("says I'm on it before the computer wakes", async () => {
    const events: LoopEvent[] = []
    const { order } = await run(2, [{ type: "done", evidence: "heading visible" }], [], { events })
    expect(events.some((event) => event.type === "message" && event.text === ON_IT_MESSAGE)).toBe(true)
    expect(order[0]).toBe("end-then-wake")
  })
})
