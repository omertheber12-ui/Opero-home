import { describe, expect, it } from "vitest"
import { formatOutline, pageReading } from "../src/computer/snapshot.js"

describe("page reading", () => {
  it("keeps the document title when the body has no heading element", () => {
    const text = pageReading({
      title: "Example Domain",
      headings: [],
      text: "This domain is for use in documentation examples.",
    })
    expect(text.startsWith("Example Domain")).toBe(true)
    expect(formatOutline("Example Domain", [])).toContain("PAGE_TITLE: Example Domain")
    expect(formatOutline("Example Domain", [])).toContain("(no heading element in the page body)")
  })

  it("does not repeat a title that is already the body text", () => {
    expect(pageReading({ title: "Example Domain", headings: [], text: "Example Domain" })).toBe("Example Domain")
  })
})
