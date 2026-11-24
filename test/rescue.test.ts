import { describe, expect, it } from "vitest"
import { blankMission, withPlan } from "../src/domain/mission.js"
import { buildRescuePacket, isSafetyStop, shouldRescue } from "../src/domain/rescue.js"
import type { Step } from "../src/domain/types.js"

const step: Step = {
  id: "s1",
  text: "Open",
  site: "https://example.com",
  doneWhen: "done",
  commit: false,
  status: "pending",
  pause: false,
  userPause: false,
}

describe("rescue", () => {
  it("skips rescue for safety stops and user control", () => {
    expect(isSafetyStop("commit")).toBe(true)
    expect(isSafetyStop("machine")).toBe(false)
    expect(shouldRescue({ reason: "goto_failed", driver: "user", pause: false })).toBe(false)
    expect(shouldRescue({ reason: "goto_failed", driver: "agent", pause: true })).toBe(false)
    expect(shouldRescue({ reason: "goto_failed", askReason: "secret", driver: "agent", pause: false })).toBe(
      false,
    )
    expect(shouldRescue({ reason: "goto_failed", driver: "agent", pause: false })).toBe(true)
  })

  it("builds a packet with recent actions and remaining budget", () => {
    const mission = {
      ...withPlan(blankMission("m1", "go", 2), "end", [step]),
      budget: 24,
      modelCalls: 4,
      recoveryAttempts: 1,
      startedAt: Date.now() - 1000,
    }
    const packet = buildRescuePacket({
      mission,
      url: "https://example.com",
      recent: [{ action: { type: "click", ref: 1, commit: false }, result: "ok" }],
      failure: "stuck",
    })
    expect(packet.remainingBudget).toBe(20)
    expect(packet.recent).toHaveLength(1)
    expect(packet.failure).toBe("stuck")
  })
})
