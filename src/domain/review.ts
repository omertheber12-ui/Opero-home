import { isBotChallenge } from "../computer/challenge.js"
import { BLANK_URL, CHROME_URL_PREFIX, STALL_ACTIONS } from "../config.js"
import { hostOf, siteHost } from "./completion.js"
import type { AgentAction, Step } from "./types.js"

const SITE_ERROR = /\b(404|page not found|access denied|something went wrong|server error|503)\b/i

export function isSiteErrorPage(pageText: string): boolean {
  return SITE_ERROR.test(pageText)
}

/** Planner review for stuck repeats, stalls, contradictions, or an explicit request. */
export function needsPlannerReview(input: {
  action: AgentAction
  url: string
  previousUrl: string
  previousAction: AgentAction | null
  stagnantActions?: number
  pageText?: string
  step?: Step
}): boolean {
  const { action, url, previousUrl, previousAction } = input
  if (action.type === "request_review") return true
  if ((input.stagnantActions ?? 0) >= STALL_ACTIONS) return true
  if (pageContradictsPlan(url, input.pageText ?? "", input.step)) return true
  if (previousAction && previousUrl === url && sameAction(previousAction, action)) return true
  return false
}

export function pageContradictsPlan(url: string, pageText: string, step: Step | undefined): boolean {
  if (!step) return false
  if (!url || url === BLANK_URL || url.startsWith(CHROME_URL_PREFIX)) return false
  if (isBotChallenge(url, pageText)) return false
  if (isSiteErrorPage(pageText)) return true
  const page = hostOf(url)
  const want = siteHost(step.site)
  if (!page || !want) return false
  if (page === want || page.endsWith(`.${want}`) || want.endsWith(`.${page}`)) return false
  // Only treat a host mismatch as a contradiction when the site looks like a real host.
  if (!want.includes(".")) return false
  return true
}

function sameAction(left: AgentAction, right: AgentAction): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
