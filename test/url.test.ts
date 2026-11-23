import { describe, expect, it } from "vitest"
import { isBlankUrl, toHttpUrl } from "../src/computer/url.js"

describe("url helpers", () => {
  it("builds https URLs from domains", () => {
    expect(toHttpUrl("bbc.com/news")).toBe("https://bbc.com/news")
    expect(toHttpUrl("https://reuters.com")).toBe("https://reuters.com")
    expect(toHttpUrl("the site named in the mission")).toBeNull()
  })

  it("detects blank browser urls", () => {
    expect(isBlankUrl("about:blank")).toBe(true)
    expect(isBlankUrl("https://example.com")).toBe(false)
  })
})
