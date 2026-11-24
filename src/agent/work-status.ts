export type WorkPhase = "planning" | "browsing" | "challenge" | "waiting" | "done" | "blocked"

export type WorkStatus = {
  missionId: string
  phase: WorkPhase
  stepHint: string
  lastAction: string
  challenge: boolean
  updatedAt: number
  detail: string
  stagnantActions?: number
  failedOpen?: boolean
  siteError?: boolean
  budgetUsed?: boolean
}

export type StatusBoard = {
  set(status: WorkStatus): void
  get(): WorkStatus | null
}

export function createStatusBoard(): StatusBoard {
  let current: WorkStatus | null = null
  return {
    set(status) {
      current = status
    },
    get() {
      return current
    },
  }
}
