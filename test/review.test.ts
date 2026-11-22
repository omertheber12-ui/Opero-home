import { describe, expect, it } from "vitest"
import { needsPlannerReview } from "../src/domain/review.js"

describe("planner review", () => {
  it("calls the planner back for done, ask, commit, and a repeated action", () => {
    expect(needsPlannerReview({ action: { type: "done", evidence: "ok" }, url: "https://a", previousUrl: "", previousAction: null })).toBe(true)
    expect(needsPlannerReview({ action: { type: "ask", question: "?", reason: "fact" }, url: "https://a", previousUrl: "", previousAction: null })).toBe(true)
    expect(needsPlannerReview({ action: { type: "click", x: 1, y: 2, commit: true }, url: "https://a", previousUrl: "", previousAction: null })).toBe(true)
    const click = { type: "click" as const, x: 3, y: 4, commit: false }
    expect(needsPlannerReview({ action: click, url: "https://a", previousUrl: "https://a", previousAction: click })).toBe(true)
  })

  it("leaves an ordinary goto with the executing agent", () => {
    expect(needsPlannerReview({ action: { type: "goto", url: "https://a" }, url: "https://start", previousUrl: "", previousAction: null })).toBe(false)
  })
})
