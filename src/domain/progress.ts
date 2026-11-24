import {
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_PER_STEP,
  RECOVERY_LIMIT,
  STALL_ACTIONS,
  STRATEGY_LIMIT,
} from "../config.js"
import type { AgentAction, PageControl } from "./types.js"

export { STALL_ACTIONS, STRATEGY_LIMIT, RECOVERY_LIMIT }

export function missionBudget(stepCount: number): number {
  return Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, stepCount * BUDGET_PER_STEP))
}

export function controlSignature(controls: PageControl[]): string {
  return controls
    .map((control) => `${control.role}:${control.name}`)
    .sort()
    .join("|")
}

export function madeProgress(input: {
  beforeUrl: string
  afterUrl: string
  stepBecameDone: boolean
  beforeControls: string
  afterControls: string
}): boolean {
  if (input.stepBecameDone) return true
  if (pathOf(input.beforeUrl) !== pathOf(input.afterUrl)) return true
  if (input.beforeControls !== input.afterControls && input.afterControls !== "") return true
  return false
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

export function sameStrategyAction(_previous: AgentAction | null, _next: AgentAction): boolean {
  return true
}
