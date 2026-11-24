import { describe, expect, it } from "vitest"
import { metricsFromTrace } from "../src/domain/metrics.js"

describe("metrics", () => {
  it("distinguishes site failures from reasoning failures", () => {
    const metrics = metricsFromTrace([
      { at: 1, missionId: "m1", kind: "action", detail: {} },
      { at: 2, missionId: "m1", kind: "ask", detail: { reason: "machine", question: "nav failed" } },
      { at: 3, missionId: "m1", kind: "ask", detail: { reason: "verify", question: "stuck" } },
      { at: 4, missionId: "m1", kind: "completion", detail: {} },
    ])
    expect(metrics.completed).toBe(true)
    expect(metrics.userInterventions).toBe(2)
    expect(metrics.failures.some((item) => item.kind === "site")).toBe(true)
    expect(metrics.failures.some((item) => item.kind === "reasoning")).toBe(true)
  })
})
