import type { TraceEvent } from "./trace.js"

export type FailureKind = "site" | "reasoning"

export type MissionMetrics = {
  completed: boolean
  userInterventions: number
  recoverySuccesses: number
  actions: number
  latencyHints: number
  modelCalls: number
  failures: Array<{ kind: FailureKind; detail: string }>
}

export function metricsFromTrace(lines: TraceEvent[]): MissionMetrics {
  const failures: MissionMetrics["failures"] = []
  let recoverySuccesses = 0
  let completed = false
  let modelCalls = 0

  for (const line of lines) {
    if (line.kind === "completion") completed = true
    if (line.kind === "plan" || line.kind === "verdict" || line.kind === "action") modelCalls += 1
    if (line.kind === "rescue" && line.detail.replan) recoverySuccesses += 1
    if (line.kind === "ask") {
      const reason = String(line.detail.reason ?? "")
      if (reason === "machine" || reason === "code") {
        failures.push({ kind: "site", detail: String(line.detail.question ?? reason) })
      } else {
        failures.push({ kind: "reasoning", detail: String(line.detail.question ?? reason) })
      }
    }
    if (line.kind === "rescue" && line.detail.unavailable) {
      failures.push({ kind: "reasoning", detail: "rescue_unavailable" })
    }
    if (line.kind === "progress" && line.detail.progress === false && line.detail.siteError) {
      failures.push({ kind: "site", detail: "site_error_page" })
    }
  }

  return {
    completed,
    userInterventions: lines.filter((line) => line.kind === "ask").length,
    recoverySuccesses,
    actions: lines.filter((line) => line.kind === "apply").length,
    latencyHints: lines.length > 1 ? lines[lines.length - 1]!.at - lines[0]!.at : 0,
    modelCalls,
    failures,
  }
}
