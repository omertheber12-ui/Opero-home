export type Level = 1 | 2
export type Language = "en" | "he"
export type StepStatus = "pending" | "waiting" | "running" | "done" | "skipped"
export type MissionStatus = "planning" | "running" | "waiting_on_user" | "done" | "blocked" | "aborted"
export type Outcome = "read" | "navigate" | "transact"

export type Step = {
  id: string
  text: string
  site: string
  doneWhen: string
  commit: boolean
  status: StepStatus
  pause: boolean
  userPause: boolean
}

export type Approval = {
  fingerprint: string
  status: "pending" | "granted"
}

export type CommitRecord = {
  fingerprint: string
  outcome: "started" | "applied" | "unknown"
}

export type Mission = {
  id: string
  request: string
  end: string
  status: MissionStatus
  steps: Step[]
  level: Level
  submits: number
  failedDetails: string[]
  question: string | null
  questionReason: AskReason | null
  outcome: Outcome
  approval: Approval | null
  lastCommit: CommitRecord | null
  budget: number
  modelCalls: number
  startedAt: number
  recoveryAttempts: number
  stagnantActions: number
  strategyId: string
}

export type AskReason =
  | "secret"
  | "code"
  | "fact"
  | "commit"
  | "verify"
  | "wrong_detail"
  | "wrong_account"
  | "machine"

export type PageControl = {
  ref: number
  role: string
  name: string
}

export type AgentAction =
  | { type: "goto"; url: string }
  | { type: "click"; ref: number; commit: boolean }
  | { type: "type"; ref: number; text: string; commit: boolean }
  | { type: "press"; key: string }
  | { type: "scroll"; direction: "up" | "down" }
  | { type: "wait"; ms?: number }
  | { type: "pointer_click"; x: number; y: number; commit: boolean }
  | { type: "fill_detail"; description: string; ref?: number }
  | { type: "read_cookies" }
  | { type: "request_review"; reason: string }
  | { type: "ask"; question: string; reason: AskReason }
  | { type: "done"; evidence: string }

export type House = {
  id: string
  language: Language
  level: Level
  profileDir: string
  vaultPath: string
}

export type Verdict =
  | { type: "approve" }
  | { type: "replace"; action: AgentAction }
  | { type: "ask"; question: string; reason: AskReason }
  | { type: "replan"; steps: Step[] }
  | { type: "stop"; question: string }
