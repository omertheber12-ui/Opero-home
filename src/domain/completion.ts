import { evidenceOnPage, groundedEvidence } from "./evidence.js"
import type { Mission, Outcome, Step } from "./types.js"

const OUTCOME_RANK: Record<Outcome, number> = { read: 0, navigate: 1, transact: 2 }

const TRANSACT_WORDS =
  /\b(pay|payment|buy|purchase|order|book|booking|delete|send|subscribe|transfer|checkout|refund)\b/i

const CONFIRM_LABEL =
  /\b(confirmation|confirmed|order\s*(id|number|#)|reference(\s*(id|number|#))?|booking(\s*(id|number|#))?|receipt|transaction\s*(id|number|#)|invoice)\b/i

export function parseOutcome(value: unknown): Outcome {
  if (value === "navigate" || value === "transact" || value === "read") return value
  return "read"
}

/** Only raise severity: read < navigate < transact. */
export function raiseOutcome(current: Outcome, next: Outcome): Outcome {
  return OUTCOME_RANK[next] > OUTCOME_RANK[current] ? next : current
}

export function inferOutcome(request: string, steps: Step[], proposed: Outcome = "read"): Outcome {
  let outcome = proposed
  if (TRANSACT_WORDS.test(request)) outcome = raiseOutcome(outcome, "transact")
  for (const step of steps) {
    if (TRANSACT_WORDS.test(`${step.text} ${step.doneWhen}`)) outcome = raiseOutcome(outcome, "transact")
  }
  return outcome
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}

export function siteHost(site: string): string {
  const withScheme = /^https?:\/\//i.test(site) ? site : `https://${site}`
  return hostOf(withScheme)
}

export function hostsMatch(pageUrl: string, site: string): boolean {
  const page = hostOf(pageUrl)
  const want = siteHost(site)
  if (!page || !want) return false
  return page === want || page.endsWith(`.${want}`) || want.endsWith(`.${page}`)
}

/** A confirmation label plus a token that contains a digit. */
export function transactProof(pageText: string): string | null {
  if (!CONFIRM_LABEL.test(pageText)) return null
  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && /\d/.test(line) && CONFIRM_LABEL.test(line))
  if (lines[0]) return lines[0]
  const digitToken = pageText.match(
    /\b(?:order|confirmation|reference|booking|receipt|transaction|invoice)[^\n\d]{0,40}([A-Z0-9-]{4,}\d[A-Z0-9-]*)\b/i,
  )
  if (digitToken?.[0]) return digitToken[0].trim()
  const anyDigitLine = pageText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => CONFIRM_LABEL.test(line) && /\d/.test(line))
  return anyDigitLine ?? null
}

export type CompletionCheck = {
  ok: boolean
  evidence: string | null
  reason: "ok" | "ungrounded" | "wrong_host" | "missing_transact_proof"
}

export function checkCompletion(input: {
  mission: Mission
  pageText: string
  url: string
  evidence: string
  step: Step | undefined
}): CompletionCheck {
  const { mission, pageText, url, evidence, step } = input
  const grounded = groundedEvidence(pageText, evidence, mission.request)

  if (mission.outcome === "transact") {
    const proof = transactProof(pageText)
    if (!proof) return { ok: false, evidence: null, reason: "missing_transact_proof" }
    return { ok: true, evidence: proof, reason: "ok" }
  }

  if (!grounded) return { ok: false, evidence: null, reason: "ungrounded" }

  if (mission.outcome === "navigate") {
    const site = step?.site ?? ""
    const onHost = !site || hostsMatch(url, site)
    const doneWhenOk = Boolean(step?.doneWhen.trim() && evidenceOnPage(pageText, step.doneWhen))
    if (!onHost) return { ok: false, evidence: null, reason: "wrong_host" }
    if (!doneWhenOk && !evidenceOnPage(pageText, grounded)) {
      return { ok: false, evidence: null, reason: "ungrounded" }
    }
  }

  return { ok: true, evidence: grounded, reason: "ok" }
}

export function mayAutoFinish(outcome: Outcome): boolean {
  return outcome === "read" || outcome === "navigate"
}
