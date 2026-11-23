import { describe, expect, it } from "vitest"
import { needsPlannerReview } from "../src/domain/review.js"

describe("planner review", () => {
  it("calls the planner only when the same action repeats on the same page", () => {
    const click = { type: "click" as const, ref: 3, commit: false }
    expect(needsPlannerReview({ action: click, url: "https://a", previousUrl: "https://a", previousAction: click })).toBe(true)
  })

  it("leaves ordinary clicks, done, ask, and goto with the actor", () => {
    expect(needsPlannerReview({ action: { type: "done", evidence: "ok" }, url: "https://a", previousUrl: "", previousAction: null })).toBe(false)
    expect(needsPlannerReview({ action: { type: "ask", question: "?", reason: "fact" }, url: "https://a", previousUrl: "", previousAction: null })).toBe(false)
    expect(needsPlannerReview({ action: { type: "click", ref: 1, commit: true }, url: "https://a", previousUrl: "", previousAction: null })).toBe(false)
    expect(needsPlannerReview({ action: { type: "goto", url: "https://a" }, url: "https://start", previousUrl: "", previousAction: null })).toBe(false)
  })
})
