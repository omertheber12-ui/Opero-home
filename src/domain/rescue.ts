import { RECENT_RESULTS } from "../config.js"
import type { AgentAction, AskReason, Mission, Step } from "./types.js"

export type RecentResult = {
  action: AgentAction
  result: string
}

export type RescuePacket = {
  url: string
  step: Step | undefined
  recent: RecentResult[]
  failure: string
  remainingBudget: number
  recoveryAttempts: number
  elapsedMs: number
  screenshot?: Buffer
}

const SAFETY_REASONS: AskReason[] = [
  "secret",
  "code",
  "wrong_detail",
  "wrong_account",
  "commit",
]

export function isSafetyStop(reason: AskReason | null | undefined): boolean {
  return Boolean(reason && SAFETY_REASONS.includes(reason))
}

export function shouldRescue(input: {
  reason: "goto_failed" | "strategy_limit" | "budget_exhausted" | "action_errors"
  askReason?: AskReason | null
  driver: "agent" | "user"
  pause: boolean
}): boolean {
  if (input.driver === "user") return false
  if (input.pause) return false
  if (isSafetyStop(input.askReason)) return false
  return true
}

export function buildRescuePacket(input: {
  mission: Mission
  url: string
  recent: RecentResult[]
  failure: string
  screenshot?: Buffer
}): RescuePacket {
  const step = input.mission.steps.find((item) => item.status !== "done")
  const elapsedMs = Math.max(0, Date.now() - (input.mission.startedAt || Date.now()))
  return {
    url: input.url,
    step,
    recent: input.recent.slice(-RECENT_RESULTS),
    failure: input.failure,
    remainingBudget: Math.max(0, input.mission.budget - input.mission.modelCalls),
    recoveryAttempts: input.mission.recoveryAttempts,
    elapsedMs,
    screenshot: input.screenshot,
  }
}
