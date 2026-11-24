import { describe, expect, it } from "vitest"
import {
  checkCompletion,
  inferOutcome,
  mayAutoFinish,
  raiseOutcome,
  transactProof,
} from "../src/domain/completion.js"
import { blankMission } from "../src/domain/mission.js"
import type { Step } from "../src/domain/types.js"

function step(overrides: Partial<Step> = {}): Step {
  return {
    id: "s1",
    text: "Open the page",
    site: "https://shop.example",
    doneWhen: "Payment confirmed",
    commit: false,
    status: "pending",
    pause: false,
    userPause: false,
    ...overrides,
  }
}

describe("completion", () => {
  it("only raises outcome severity", () => {
    expect(raiseOutcome("read", "navigate")).toBe("navigate")
    expect(raiseOutcome("transact", "read")).toBe("transact")
    expect(raiseOutcome("navigate", "transact")).toBe("transact")
  })

  it("forces transact from pay language even when the planner proposed read", () => {
    expect(inferOutcome("Pay the electricity bill", [step()], "read")).toBe("transact")
    expect(inferOutcome("Read the news", [step({ text: "Copy headlines", doneWhen: "headlines" })], "read")).toBe(
      "read",
    )
  })

  it("rejects a payment doneWhen sentence without a confirmation token", () => {
    const mission = { ...blankMission("m1", "Pay the bill", 2), outcome: "transact" as const, end: "Payment confirmed" }
    const page = "Payment confirmed\nThank you for your order"
    expect(transactProof(page)).toBeNull()
    const result = checkCompletion({
      mission,
      pageText: page,
      url: "https://shop.example/done",
      evidence: "Payment confirmed",
      step: step(),
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("missing_transact_proof")
  })

  it("accepts a confirmation line that includes a digit token", () => {
    const page = "Order confirmation\nOrder number: ORD-88421\nThank you"
    expect(transactProof(page)).toContain("88421")
    const mission = { ...blankMission("m1", "Pay the bill", 2), outcome: "transact" as const, end: "paid" }
    const result = checkCompletion({
      mission,
      pageText: page,
      url: "https://shop.example/done",
      evidence: "Payment confirmed",
      step: step(),
    })
    expect(result.ok).toBe(true)
    expect(result.evidence).toMatch(/\d/)
  })

  it("accepts read completion from grounded page wording", () => {
    const mission = { ...blankMission("m1", "Read headlines", 2), outcome: "read" as const, end: "headlines" }
    const page = "Israel and Iran ceasefire talks resume today"
    const result = checkCompletion({
      mission,
      pageText: page,
      url: "https://news.example",
      evidence: "Israel and Iran ceasefire talks resume today",
      step: step({ site: "https://news.example", doneWhen: "talks" }),
    })
    expect(result.ok).toBe(true)
  })

  it("rejects navigate completion on the wrong host", () => {
    const mission = { ...blankMission("m1", "Open settings", 2), outcome: "navigate" as const, end: "Settings" }
    const result = checkCompletion({
      mission,
      pageText: "Settings page is ready for you now",
      url: "https://other.example/settings",
      evidence: "Settings page is ready for you now",
      step: step({ site: "https://shop.example", doneWhen: "Settings" }),
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("wrong_host")
  })

  it("blocks auto-finish for transact missions", () => {
    expect(mayAutoFinish("transact")).toBe(false)
    expect(mayAutoFinish("read")).toBe(true)
    expect(mayAutoFinish("navigate")).toBe(true)
  })
})
