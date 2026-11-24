import { WRONG_ACCOUNT_TEMPLATE } from "../config.js"
import type { AgentAction, Mission, Outcome, Step } from "./types.js"

const CONSEQUENTIAL_NAME =
  /\b(submit|pay|payment|purchase|buy|place order|delete|remove|send|sign in|log in|login|sign up|signup|confirm order|checkout)\b/i

const YES = /^(yes|y|continue|approve|ok|okay|כן|אישור|המשך)\.?$/i
const NO = /^(no|n|stop|cancel|don't|do not|לא|בטל)\.?$/i

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

export function consequential(
  action: AgentAction,
  controlName: string,
  outcome: Outcome,
  step: Step | undefined,
): boolean {
  if (action.type === "fill_detail" || action.type === "ask" || action.type === "done") return false
  if (action.type === "request_review" || action.type === "read_cookies") return false
  if (action.type === "goto" || action.type === "scroll" || action.type === "wait") return false

  if (
    (action.type === "click" || action.type === "type" || action.type === "pointer_click") &&
    action.commit
  ) {
    return true
  }

  if ((action.type === "click" || action.type === "pointer_click") && CONSEQUENTIAL_NAME.test(controlName)) {
    return true
  }

  if (action.type === "press" && action.key.toLowerCase() === "enter") {
    return outcome === "transact" && Boolean(step?.commit)
  }

  return false
}

export function pauseBlocks(mission: Mission): boolean {
  const step = mission.steps.find((item) => item.status !== "done")
  return Boolean(step && (step.pause || step.userPause))
}

export function actionFingerprint(url: string, action: AgentAction, controlName: string): string {
  if (action.type === "click") {
    return JSON.stringify({ type: "click", url, ref: action.ref, controlName })
  }
  if (action.type === "pointer_click") {
    return JSON.stringify({ type: "pointer_click", url, x: action.x, y: action.y, controlName })
  }
  if (action.type === "type") {
    return JSON.stringify({ type: "type", url, ref: action.ref, controlName, commit: action.commit })
  }
  if (action.type === "press") {
    return JSON.stringify({ type: "press", url, key: action.key, controlName })
  }
  return JSON.stringify({ type: action.type, url, controlName })
}

export function parseApprovalReply(text: string): "yes" | "no" | "guidance" {
  const trimmed = text.trim()
  if (YES.test(trimmed)) return "yes"
  if (NO.test(trimmed)) return "no"
  return "guidance"
}

export type PolicyDecision =
  | { kind: "run" }
  | { kind: "ask_commit"; fingerprint: string }
  | { kind: "ask_pause" }
  | { kind: "ask_unknown" }
  | { kind: "ask_wrong_account"; question: string }
  | { kind: "ask_failed_detail" }

export function decidePolicy(input: {
  mission: Mission
  action: AgentAction
  url: string
  controlName: string
  pageText: string
}): PolicyDecision {
  const { mission, action, url, controlName, pageText } = input
  const step = mission.steps.find((item) => item.status !== "done")

  if (action.type === "ask" || action.type === "done" || action.type === "read_cookies") return { kind: "run" }
  if (action.type === "request_review") return { kind: "run" }

  if (action.type === "fill_detail") {
    return mission.failedDetails.includes(action.description) ? { kind: "ask_failed_detail" } : { kind: "run" }
  }

  if (pauseBlocks(mission)) return { kind: "ask_pause" }

  const account = wrongAccount(mission.request, pageText)
  if (account) return { kind: "ask_wrong_account", question: account }

  const isCommit = consequential(action, controlName, mission.outcome, step)
  if (!isCommit) return { kind: "run" }

  if (mission.lastCommit?.outcome === "unknown" || mission.lastCommit?.outcome === "applied") {
    return { kind: "ask_unknown" }
  }

  const fingerprint = actionFingerprint(url, action, controlName)

  if (mission.approval?.status === "granted" && mission.approval.fingerprint === fingerprint) {
    return { kind: "run" }
  }

  if (mission.submits >= 1) return { kind: "ask_commit", fingerprint }
  if (mission.level === 1) return { kind: "ask_commit", fingerprint }
  if (step && (step.pause || step.userPause)) return { kind: "ask_pause" }

  return { kind: "run" }
}

export function wrongAccount(request: string, pageText: string): string | null {
  const wanted = request.match(EMAIL)?.map((value) => value.toLowerCase()) ?? []
  if (wanted.length === 0) return null
  const onPage = pageText.match(EMAIL)?.map((value) => value.toLowerCase()) ?? []
  if (onPage.length === 0) return null
  const match = wanted.some((email) => onPage.includes(email))
  if (match) return null
  return WRONG_ACCOUNT_TEMPLATE(wanted[0]!)
}

export function grantApproval(mission: Mission, reply: string): Mission {
  if (!mission.approval || mission.approval.status !== "pending") return mission
  const verdict = parseApprovalReply(reply)
  if (verdict === "yes") {
    return { ...mission, approval: { ...mission.approval, status: "granted" } }
  }
  if (verdict === "no") {
    return { ...mission, approval: null }
  }
  return mission
}

export function consumeApproval(mission: Mission, fingerprint: string): Mission {
  if (mission.approval?.status === "granted" && mission.approval.fingerprint === fingerprint) {
    return { ...mission, approval: null }
  }
  return mission
}

export function markCommitStarted(mission: Mission, fingerprint: string): Mission {
  return {
    ...mission,
    submits: mission.submits + 1,
    approval: null,
    lastCommit: { fingerprint, outcome: "started" },
  }
}

export function markCommitApplied(mission: Mission): Mission {
  if (!mission.lastCommit || mission.lastCommit.outcome !== "started") return mission
  return { ...mission, lastCommit: { ...mission.lastCommit, outcome: "applied" } }
}

export function markCommitUnknown(mission: Mission): Mission {
  if (!mission.lastCommit) return mission
  return { ...mission, lastCommit: { ...mission.lastCommit, outcome: "unknown" } }
}
