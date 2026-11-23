import type { AgentAction } from "./types.js"

/** Planner review is only for a stuck repeated action. Ordinary clicks, done, and asks stay with the actor. */
export function needsPlannerReview(input: {
  action: AgentAction
  url: string
  previousUrl: string
  previousAction: AgentAction | null
}): boolean {
  const { action, url, previousUrl, previousAction } = input
  if (previousAction && previousUrl === url && sameAction(previousAction, action)) return true
  return false
}

function sameAction(left: AgentAction, right: AgentAction): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
