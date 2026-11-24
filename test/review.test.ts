import { describe, expect, it } from "vitest"
import { needsPlannerReview, pageContradictsPlan } from "../src/domain/review.js"

describe("planner review", () => {
  it("calls the planner when the same action repeats on the same page", () => {
    const click = { type: "click" as const, ref: 3, commit: false }
    expect(needsPlannerReview({ action: click, url: "https://a.example", previousUrl: "https://a.example", previousAction: click })).toBe(true)
  })

  it("calls the planner on request_review or a stall", () => {
    expect(
      needsPlannerReview({
        action: { type: "request_review", reason: "stuck" },
        url: "https://a.example",
        previousUrl: "https://a.example",
        previousAction: null,
      }),
    ).toBe(true)
    expect(
      needsPlannerReview({
        action: { type: "click", ref: 1, commit: false },
        url: "https://a.example",
        previousUrl: "https://a.example",
        previousAction: null,
        stagnantActions: 3,
      }),
    ).toBe(true)
  })

  it("leaves ordinary first clicks, done, ask, and goto with the actor", () => {
    expect(needsPlannerReview({ action: { type: "done", evidence: "ok" }, url: "https://a.example", previousUrl: "", previousAction: null })).toBe(false)
    expect(needsPlannerReview({ action: { type: "ask", question: "?", reason: "fact" }, url: "https://a.example", previousUrl: "", previousAction: null })).toBe(false)
    expect(needsPlannerReview({ action: { type: "click", ref: 1, commit: true }, url: "https://a.example", previousUrl: "", previousAction: null })).toBe(false)
    expect(needsPlannerReview({ action: { type: "goto", url: "https://a.example" }, url: "https://start.example", previousUrl: "", previousAction: null, step: undefined })).toBe(false)
  })

  it("detects a host contradiction against the current step", () => {
    expect(
      pageContradictsPlan("https://other.example/x", "welcome", {
        id: "s1",
        text: "Open",
        site: "https://shop.example",
        doneWhen: "done",
        commit: false,
        status: "pending",
        pause: false,
        userPause: false,
      }),
    ).toBe(true)
  })
})
