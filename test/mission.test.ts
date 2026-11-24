import { describe, expect, it } from "vitest"
import { blankMission, canStart, gate, userEditsEnd, withPlan } from "../src/domain/mission.js"
import type { Step } from "../src/domain/types.js"

function step(overrides: Partial<Step> = {}): Step {
  return {
    id: "s1",
    text: "Open the page",
    site: "https://example.com",
    doneWhen: "The heading is visible",
    commit: false,
    status: "pending",
    pause: false,
    userPause: false,
    ...overrides,
  }
}

describe("mission rules", () => {
  it("refuses a second mission while one is running or waiting", () => {
    const running = blankMission("m1", "go", 2)
    running.status = "running"
    const waiting = { ...running, status: "waiting_on_user" as const }
    expect(canStart(running)).toBe(false)
    expect(canStart(waiting)).toBe(false)
    expect(canStart(null)).toBe(true)
    expect(canStart({ ...running, status: "done" })).toBe(true)
    expect(canStart({ ...running, status: "aborted" })).toBe(true)
    expect(canStart({ ...running, status: "blocked" })).toBe(true)
  })

  it("sets the end once", () => {
    const mission = withPlan(blankMission("m1", "go", 2), "heading visible", [step()])
    const rejected = withPlan(mission, "a different end", [step({ text: "other" })])
    const sameEnd = withPlan(mission, "heading visible", [step({ text: "other" })])
    expect(mission.end).toBe("heading visible")
    expect(rejected.end).toBe("heading visible")
    expect(rejected.steps[0]?.text).toBe("Open the page")
    expect(sameEnd.steps[0]?.text).toBe("other")
  })

  it("keeps a user pause when the agent clears it", () => {
    const mission = withPlan(blankMission("m1", "go", 2), "end", [step({ userPause: true, pause: true })])
    const updated = withPlan(mission, "end", [step({ pause: false, userPause: false })])
    expect(updated.steps[0]?.pause).toBe(true)
    expect(updated.steps[0]?.userPause).toBe(true)
  })

  it("lets the user replace the end", () => {
    const mission = withPlan(blankMission("m1", "go", 2), "old", [step()])
    expect(userEditsEnd(mission, "new").end).toBe("new")
  })

  it("asks on level 1 commits and runs ordinary clicks", () => {
    const level1 = withPlan(blankMission("m1", "go", 1), "end", [step()])
    const level2 = withPlan(blankMission("m2", "go", 2), "end", [step()])
    const commit = { type: "click" as const, ref: 1, commit: true }
    const reading = { type: "click" as const, ref: 1, commit: false }
    expect(gate(level1, commit)).toBe("ask")
    expect(gate(level1, reading)).toBe("run")
    expect(gate(level2, reading)).toBe("run")
  })

  it("runs a level 2 commit unless one already happened or the step is paused", () => {
    const mission = withPlan(blankMission("m1", "go", 2), "end", [step({ status: "running" })])
    const commit = { type: "click" as const, ref: 1, commit: true }
    expect(gate(mission, commit)).toBe("run")
    expect(gate({ ...mission, submits: 1 }, commit)).toBe("ask")
    const paused = withPlan(blankMission("m2", "go", 2), "end", [step({ status: "running", pause: true })])
    expect(gate(paused, commit)).toBe("ask")
  })

  it("asks before filling a detail that was already rejected", () => {
    const mission = withPlan(blankMission("m1", "go", 2), "end", [step()])
    const fill = { type: "fill_detail" as const, description: "card number" }
    expect(gate(mission, fill)).toBe("run")
    expect(gate({ ...mission, failedDetails: ["card number"] }, fill)).toBe("ask")
  })
})
