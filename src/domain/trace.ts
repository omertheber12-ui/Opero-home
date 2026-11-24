import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { transcript } from "../vault/vault.js"

export type TraceEvent = {
  at: number
  missionId: string
  kind: "plan" | "action" | "verdict" | "gate" | "apply" | "completion" | "ask" | "rescue" | "progress"
  class?: "site" | "reasoning"
  detail: Record<string, unknown>
}

/** Site is a navigation error, a machine or code ask, or a site error page. Reasoning is a stall, any other ask, or a rescue stop. */
export function failureClass(
  kind: TraceEvent["kind"],
  detail: Record<string, unknown>,
): "site" | "reasoning" | null {
  if (kind === "ask") {
    const reason = String(detail.reason ?? "")
    return reason === "machine" || reason === "code" ? "site" : "reasoning"
  }
  if (kind === "rescue") {
    if (detail.reason === "goto_failed" || detail.siteError === true) return "site"
    return "reasoning"
  }
  if (kind === "progress" && detail.progress === false && detail.siteError === true) return "site"
  return null
}

export type TraceWriter = {
  append(event: TraceEvent, secrets?: string[]): Promise<void>
}

export function createTraceWriter(dataDir: string): TraceWriter {
  return {
    async append(event, secrets = []) {
      const dir = join(dataDir, "traces")
      await mkdir(dir, { recursive: true })
      const failure = failureClass(event.kind, event.detail)
      const safe = {
        ...event,
        ...(failure ? { class: failure } : {}),
        detail: redactDetail(event.detail, secrets),
      }
      await appendFile(join(dir, `${event.missionId}.jsonl`), `${JSON.stringify(safe)}\n`)
    },
  }
}

export function redactDetail(detail: Record<string, unknown>, secrets: string[]): Record<string, unknown> {
  const raw = JSON.stringify(detail)
  const cleaned = transcript([raw], secrets)
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    return { redacted: cleaned }
  }
}

export function summarizeTrace(lines: TraceEvent[]): {
  actions: number
  asks: number
  completions: number
  rescues: number
  modelHints: number
} {
  return {
    actions: lines.filter((line) => line.kind === "action" || line.kind === "apply").length,
    asks: lines.filter((line) => line.kind === "ask").length,
    completions: lines.filter((line) => line.kind === "completion").length,
    rescues: lines.filter((line) => line.kind === "rescue").length,
    modelHints: lines.filter((line) => line.kind === "verdict" || line.kind === "plan").length,
  }
}
