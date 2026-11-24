import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { MISSION_ABORT_MS, THREAD_RECENT } from "../config.js"
import { isLiveMission, withAborted } from "../domain/mission.js"
import type { Mission } from "../domain/types.js"

export type ConversationMessage = {
  id: string
  role: "user" | "agent"
  text: string
  at: number
  missionId?: string | null
}

export type ConversationSnapshot = {
  id: string
  messages: ConversationMessage[]
  missions: Mission[]
  updatedAt: number
}

export type ConversationStore = {
  snapshot(): ConversationSnapshot
  recentThread(limit?: number): Array<{ role: "user" | "agent"; text: string }>
  appendMessage(role: "user" | "agent", text: string, missionId?: string | null): Promise<ConversationMessage>
  saveMission(mission: Mission): Promise<void>
  abortQuietMissions(nowMs: number, lastActivityMs: number): Promise<Mission | null>
}

export type OpenConversationResult = {
  store: ConversationStore
  /** Live leftover aborted on an empty thread; caller should sync house.json. */
  abortedLeftover: Mission | null
}

function conversationPath(dataDir: string): string {
  return join(dataDir, "conversation.json")
}

function blankConversation(): ConversationSnapshot {
  return {
    id: "conversation_house",
    messages: [],
    missions: [],
    updatedAt: Date.now(),
  }
}

function asConversation(value: unknown): ConversationSnapshot | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== "string" || !Array.isArray(record.messages) || !Array.isArray(record.missions)) {
    return null
  }
  return {
    id: record.id,
    messages: record.messages as ConversationMessage[],
    missions: record.missions as Mission[],
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
  }
}

export async function openConversation(
  dataDir: string,
  leftover?: { mission: Mission | null; lastActivityMs?: number },
): Promise<OpenConversationResult> {
  await mkdir(dataDir, { recursive: true })
  const file = conversationPath(dataDir)
  let data = blankConversation()
  let loaded = false
  try {
    const parsed = asConversation(JSON.parse(await readFile(file, "utf8")))
    if (parsed) {
      data = parsed
      loaded = true
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error
  }

  let abortedLeftover: Mission | null = null

  if (!loaded && leftover?.mission) {
    // First conversation file: a leftover live mission must not block the next request.
    const mission = isLiveMission(leftover.mission) ? withAborted(leftover.mission) : leftover.mission
    if (isLiveMission(leftover.mission)) abortedLeftover = mission
    data.missions = [mission]
    data.updatedAt = Date.now()
    await writeFile(file, JSON.stringify(data, null, 2))
  } else if (!loaded) {
    await writeFile(file, JSON.stringify(data, null, 2))
  }

  // Empty thread: no live mission may remain, including a house leftover still waiting_on_user.
  if (data.messages.length === 0) {
    let changed = false
    if (leftover?.mission && isLiveMission(leftover.mission)) {
      const aborted = withAborted(leftover.mission)
      const index = data.missions.findIndex((mission) => mission.id === leftover.mission!.id)
      if (index < 0) {
        data.missions.push(aborted)
        changed = true
      } else if (isLiveMission(data.missions[index]!)) {
        data.missions[index] = aborted
        changed = true
      }
      abortedLeftover = index >= 0 && data.missions[index]?.status === "aborted" ? data.missions[index]! : aborted
    }
    data.missions = data.missions.map((mission) => {
      if (!isLiveMission(mission)) return mission
      changed = true
      const aborted = withAborted(mission)
      abortedLeftover = aborted
      return aborted
    })
    if (changed) {
      data.updatedAt = Date.now()
      await writeFile(file, JSON.stringify(data, null, 2))
    }
  }

  let nextMessageId = data.messages.length + 1

  async function persist(): Promise<void> {
    data.updatedAt = Date.now()
    await writeFile(file, JSON.stringify(data, null, 2))
  }

  const store: ConversationStore = {
    snapshot() {
      return {
        id: data.id,
        messages: [...data.messages],
        missions: data.missions.map((mission) => ({ ...mission })),
        updatedAt: data.updatedAt,
      }
    },
    recentThread(limit = THREAD_RECENT) {
      return data.messages.slice(-limit).map((message) => ({ role: message.role, text: message.text }))
    },
    async appendMessage(role, text, missionId = null) {
      const message: ConversationMessage = {
        id: `msg${nextMessageId++}`,
        role,
        text,
        at: Date.now(),
        missionId,
      }
      data.messages.push(message)
      await persist()
      return message
    },
    async saveMission(mission) {
      const index = data.missions.findIndex((item) => item.id === mission.id)
      if (index >= 0) data.missions[index] = mission
      else data.missions.push(mission)
      await persist()
    },
    async abortQuietMissions(nowMs, lastActivityMs) {
      let aborted: Mission | null = null
      data.missions = data.missions.map((mission) => {
        if (!isLiveMission(mission)) return mission
        if (nowMs - lastActivityMs < MISSION_ABORT_MS) return mission
        aborted = withAborted(mission)
        return aborted
      })
      if (aborted) await persist()
      return aborted
    },
  }

  return { store, abortedLeftover }
}
