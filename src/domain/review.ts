import type { AgentAction } from "./types.js"

export function needsPlannerReview(input: {
  action: AgentAction
  url: string
  previousUrl: string
  previousAction: AgentAction | null
}): boolean {
  const { action, url, previousUrl, previousAction } = input
  if (action.type === "done" || action.type === "ask") return true
  if ((action.type === "click" || action.type === "type") && action.commit) return true
  if (previousAction && previousUrl === url && sameAction(previousAction, action)) return true
  return false
}

function sameAction(left: AgentAction, right: AgentAction): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
