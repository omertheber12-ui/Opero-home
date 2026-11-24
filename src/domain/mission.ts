import { BUDGET_MIN } from "../config.js"
import { missionBudget } from "./progress.js"
import { decidePolicy } from "./policy.js"
import type { AgentAction, Level, Mission, Outcome, Step } from "./types.js"

export function blankMission(id: string, request: string, level: Level): Mission {
  return {
    id,
    request,
    end: "",
    status: "planning",
    steps: [],
    level,
    submits: 0,
    failedDetails: [],
    question: null,
    questionReason: null,
    outcome: "read",
    approval: null,
    lastCommit: null,
    budget: BUDGET_MIN,
    modelCalls: 0,
    startedAt: Date.now(),
    recoveryAttempts: 0,
    stagnantActions: 0,
    strategyId: "s0",
  }
}

export function canStart(active: Mission | null): boolean {
  return (
    active === null ||
    active.status === "done" ||
    active.status === "blocked" ||
    active.status === "aborted"
  )
}

export function isLiveMission(active: Mission | null): boolean {
  return (
    active !== null &&
    (active.status === "planning" ||
      active.status === "running" ||
      active.status === "waiting_on_user")
  )
}

export function withAborted(mission: Mission): Mission {
  return {
    ...mission,
    status: "aborted",
    question: null,
    questionReason: null,
  }
}

export function withPlan(mission: Mission, end: string, steps: Step[], outcome?: Outcome): Mission {
  if (mission.end !== "" && end !== mission.end) return mission
  const kept = new Map(mission.steps.map((step) => [step.id, step]))
  const nextOutcome = outcome ?? mission.outcome
  return {
    ...mission,
    end: mission.end === "" ? end : mission.end,
    status: "running",
    outcome: nextOutcome,
    budget: missionBudget(steps.length),
    steps: steps.map((step) => {
      const previous = kept.get(step.id)
      return previous?.userPause ? { ...step, pause: true, userPause: true } : step
    }),
  }
}

export function userEditsEnd(mission: Mission, end: string): Mission {
  return { ...mission, end }
}

/** Commit and pause decisions live in policy. This keeps the old gate shape for callers. */
export function gate(
  mission: Mission,
  action: AgentAction,
  controlName = "",
  url = "",
  pageText = "",
): "run" | "ask" {
  const decision = decidePolicy({ mission, action, url, controlName, pageText })
  return decision.kind === "run" ? "run" : "ask"
}

export function stepsAreClear(steps: Step[]): boolean {
  return steps.length > 0 && steps.every((step) => step.site.trim() !== "" && step.text.trim() !== "" && step.doneWhen.trim() !== "")
}
