import { describe, expect, it } from "vitest"
import { UNREAD_PLAN } from "../src/config.js"
import { buildConverseMessages, buildPlanMessages, parsePlan, parseSteer } from "../src/agent/planner.js"

describe("parsePlan", () => {
  it("keeps a clarifying ask before any steps", () => {
    expect(parsePlan({ type: "ask", question: "Which city should I book?" })).toEqual({
      type: "ask",
      question: "Which city should I book?",
    })
  })

  it("reads a normal plan", () => {
    const plan = parsePlan({
      type: "plan",
      end: "heading visible",
      outcome: "read",
      steps: [{ id: "s1", text: "Open", site: "https://example.com", doneWhen: "heading visible" }],
    })
    expect(plan.type).toBe("plan")
    if (plan.type === "plan") {
      expect(plan.end).toBe("heading visible")
      expect(plan.steps).toHaveLength(1)
    }
  })
})

describe("buildPlanMessages", () => {
  it("sends the thread as separate user and assistant turns", () => {
    const messages = buildPlanMessages({
      request: "Book a transport appointment",
      language: "en",
      thread: [
        { role: "user", text: "Book a transport appointment" },
        { role: "agent", text: "Which city?" },
        { role: "user", text: "Tel Aviv" },
      ],
    })
    expect(messages[0]?.role).toBe("system")
    expect(messages.slice(1)).toEqual([
      { role: "user", content: "Book a transport appointment" },
      { role: "assistant", content: "Which city?" },
      { role: "user", content: "Tel Aviv" },
    ])
    expect(messages.some((message) => typeof message.content === "string" && message.content.includes("User guidance"))).toBe(
      false,
    )
  })

  it("falls back to a single mission message when the thread is empty", () => {
    const messages = buildPlanMessages({ request: "Open example.com", language: "he", thread: [] })
    expect(messages).toHaveLength(2)
    expect(messages[1]?.role).toBe("user")
    expect(String(messages[1]?.content)).toContain("Mission: Open example.com")
  })
})

describe("buildConverseMessages", () => {
  it("sends the thread as turns and omits the pasted Recent thread block", () => {
    const messages = buildConverseMessages({
      request: "Book a transport appointment",
      end: "appointment booked",
      status: "running",
      question: null,
      driver: "agent",
      personCheck: false,
      pageUrl: "https://example.com",
      pageText: "welcome",
      message: "what is happening",
      language: "en",
      thread: [
        { role: "user", text: "Book a transport appointment" },
        { role: "agent", text: "I'm on it." },
        { role: "user", text: "what is happening" },
      ],
    })
    expect(messages.some((message) => message.role === "assistant")).toBe(true)
    expect(messages.filter((message) => message.role === "user").length).toBeGreaterThanOrEqual(2)
    const joined = messages.map((message) => String(message.content)).join("\n")
    expect(joined).not.toContain("Recent thread:")
    expect(joined.match(/what is happening/g)?.length).toBe(1)
  })
})

describe("parseSteer", () => {
  it("keeps a status reply", () => {
    expect(parseSteer({ type: "reply", text: "Still waiting on the person check." })).toEqual({
      type: "reply",
      text: "Still waiting on the person check.",
    })
  })

  it("treats an unknown shape as a reply, not a new mission", () => {
    expect(parseSteer({ type: "browse" })).toEqual({ type: "reply", text: UNREAD_PLAN })
  })

  it("reads guide, replan, resume, stop, and start", () => {
    expect(parseSteer({ type: "guide", note: "use the booking link" })).toEqual({
      type: "guide",
      text: "",
      note: "use the booking link",
    })
    expect(parseSteer({ type: "replan", text: "Updated.", steps: [] }).type).toBe("replan")
    expect(parseSteer({ type: "resume", text: "Continuing." })).toEqual({ type: "resume", text: "Continuing." })
    expect(parseSteer({ type: "stop", question: "Stop here?" })).toEqual({ type: "stop", question: "Stop here?" })
    expect(parseSteer({ type: "start" })).toEqual({ type: "start" })
    expect(parseSteer({ type: "queue" })).toEqual({ type: "start" })
  })
})
