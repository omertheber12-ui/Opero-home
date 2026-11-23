import { describe, expect, it } from "vitest"
import {
  evidenceOnPage,
  quotedEvidence,
  requestKeywords,
  topicLinesFromPage,
} from "../src/domain/evidence.js"

describe("evidence", () => {
  it("accepts a quote when whitespace differs", () => {
    const page = "Israel and Iran\nceasefire talks resume today"
    expect(evidenceOnPage(page, "Israel and Iran ceasefire talks resume today")).toBe(true)
  })

  it("rejects a paraphrase that is not on the page", () => {
    const page = "Israel and Iran ceasefire talks resume today"
    expect(evidenceOnPage(page, "Talks between Israel and Iran are underway")).toBe(false)
  })

  it("keeps real headline lines and drops an invented summary preamble", () => {
    const page = "November 21, 2026 — Qatari delegation visits Tehran for talks\nOther story"
    const evidence =
      "Latest Israel-Iran war coverage on Reuters Middle East:\n\nNovember 21, 2026 — Qatari delegation visits Tehran for talks"
    expect(quotedEvidence(page, evidence)).toBe("November 21, 2026 — Qatari delegation visits Tehran for talks")
  })

  it("recovers a page headline when the model rewrites punctuation", () => {
    const page = "Qatari delegation visits Tehran for talks, Iranian official says\nMarkets open higher"
    const evidence = "November 21, 2026: Qatari delegation visits Tehran for talks, Iranian official says."
    expect(quotedEvidence(page, evidence)).toContain("Qatari delegation visits Tehran")
  })

  it("pulls topic lines from the page when the model invents a summary", () => {
    const page =
      "Skip to main content\nIsrael and Iran tensions rise after overnight strikes\nQatar hosts talks on Iran nuclear file\nSubscribe now"
    expect(topicLinesFromPage(page, "latest Israel Iran war news")).toContain("Israel and Iran")
  })

  it("builds keywords from the mission request without a fixed country list", () => {
    expect(requestKeywords("latest Ukraine Russia ceasefire news")).toEqual(
      expect.arrayContaining(["ukraine", "russia", "ceasefire"]),
    )
    expect(requestKeywords("latest Ukraine Russia ceasefire news")).not.toContain("latest")
    expect(requestKeywords("latest Ukraine Russia ceasefire news")).not.toContain("news")
  })

  it("pulls topic lines for a non Israel-Iran mission from request words", () => {
    const page =
      "Markets open\nUkraine and Russia discuss a new ceasefire draft in Geneva\nTraders watch oil prices climb overnight"
    const lines = topicLinesFromPage(page, "latest Ukraine Russia ceasefire news")
    expect(lines).toContain("Ukraine and Russia discuss a new ceasefire draft in Geneva")
  })

  it("returns null when the page does not match the mission topic", () => {
    const page = "Recipes for summer pasta\nHow to bake sourdough bread at home this weekend"
    expect(topicLinesFromPage(page, "latest Israel Iran war news")).toBeNull()
  })
})
