import type { AgentAction, Level, Mission, Step } from "./types.js"

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
  }
}

export function canStart(active: Mission | null): boolean {
  return active === null || active.status === "done" || active.status === "blocked"
}

export function withPlan(mission: Mission, end: string, steps: Step[]): Mission {
  if (mission.end !== "" && end !== mission.end) return mission
  const kept = new Map(mission.steps.map((step) => [step.id, step]))
  return {
    ...mission,
    end: mission.end === "" ? end : mission.end,
    status: "running",
    steps: steps.map((step) => {
      const previous = kept.get(step.id)
      return previous?.userPause ? { ...step, pause: true, userPause: true } : step
    }),
  }
}

export function userEditsEnd(mission: Mission, end: string): Mission {
  return { ...mission, end }
}

export function gate(mission: Mission, action: AgentAction): "run" | "ask" {
  if (action.type === "ask" || action.type === "done" || action.type === "read_cookies") return "run"
  if (action.type === "fill_detail") {
    return mission.failedDetails.includes(action.description) ? "ask" : "run"
  }
  const commit =
    ((action.type === "click" || action.type === "type" || action.type === "pointer_click") && action.commit)
  if (!commit) return "run"
  if (mission.submits >= 1) return "ask"
  if (mission.level === 1) return "ask"
  if (mission.steps.some((step) => step.status === "running" && step.pause)) return "ask"
  return "run"
}

export function stepsAreClear(steps: Step[]): boolean {
  return steps.length > 0 && steps.every((step) => step.site.trim() !== "" && step.text.trim() !== "" && step.doneWhen.trim() !== "")
}
