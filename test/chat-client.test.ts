import { describe, expect, it } from "vitest"
import { parseJsonContent, threadToChatMessages } from "../src/model/chat-client.js"

describe("parseJsonContent", () => {
  it("parses plain JSON", () => {
    expect(parseJsonContent('{"type":"approve"}')).toEqual({ type: "approve" })
  })

  it("parses JSON wrapped in a fence", () => {
    expect(parseJsonContent('```json\n{"end":"ok","steps":[]}\n```')).toEqual({ end: "ok", steps: [] })
  })
})

describe("threadToChatMessages", () => {
  it("maps a two-line thread to one user message and one assistant message", () => {
    expect(
      threadToChatMessages([
        { role: "user", text: "Book a transport appointment" },
        { role: "agent", text: "Which city?" },
      ]),
    ).toEqual([
      { role: "user", content: "Book a transport appointment" },
      { role: "assistant", content: "Which city?" },
    ])
  })
})
