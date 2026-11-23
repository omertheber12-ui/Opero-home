import { describe, expect, it } from "vitest"
import { parseJsonContent } from "../src/model/chat-client.js"

describe("parseJsonContent", () => {
  it("parses plain JSON", () => {
    expect(parseJsonContent('{"type":"approve"}')).toEqual({ type: "approve" })
  })

  it("parses JSON wrapped in a fence", () => {
    expect(parseJsonContent('```json\n{"end":"ok","steps":[]}\n```')).toEqual({ end: "ok", steps: [] })
  })
})
