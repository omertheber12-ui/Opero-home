export type Level = 1 | 2
export type Language = "en" | "he"
export type StepStatus = "pending" | "waiting" | "running" | "done" | "skipped"
export type MissionStatus = "planning" | "running" | "waiting_on_user" | "done" | "blocked"

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

export type AgentAction =
  | { type: "goto"; url: string }
  | { type: "click"; x: number; y: number; commit: boolean }
  | { type: "type"; text: string; commit: boolean }
  | { type: "fill_detail"; description: string }
  | { type: "read_cookies" }
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
