import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { WebSocketServer, type WebSocket } from "ws"
import { HouseLoop, type LoopEvent } from "../agent/loop.js"
import { createStatusBoard } from "../agent/work-status.js"
import { createExecutor, type Executor } from "../agent/executor.js"
import { createPlanner, type Planner } from "../agent/planner.js"
import { loadEnvFile } from "../boot/env.js"
import { ensureVaultKey, loadBrowserbaseKey, loadXaiKey, saveXaiKey, verifyXaiKey } from "../boot/secrets.js"
import { FakeComputer } from "../computer/computer.js"
import { openChrome } from "../computer/playwright-computer.js"
import { jpegSize } from "../computer/jpeg-size.js"
import type { Computer } from "../computer/computer.js"
import { graceOpen } from "../domain/grace.js"
import { isLiveMission } from "../domain/mission.js"
import { markCommitUnknown } from "../domain/policy.js"
import { createTraceWriter } from "../domain/trace.js"
import type { Language, Level, Mission } from "../domain/types.js"
import { labels } from "./i18n.js"
import {
  BIND_HOST,
  DEFAULT_MODEL,
  DEFAULT_PORT,
  GRACE_POLL_MS,
  MISSING_GROK_KEY,
  MISSING_GROK_KEY_ASK,
  MISSING_GROK_KEY_SHORT,
  RESTART_QUESTION,
  SCREEN_INTERVAL_MS,
  SUPERVISE_POLL_MS,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORK_STATUS_POLL_MS,
} from "../config.js"
import { openConversation } from "../store/conversation-store.js"
import { openHouse, saveHouse, withSettings } from "../store/house-store.js"
import { loadKey, Vault } from "../vault/vault.js"

await loadEnvFile()

const port = Number(process.env.PORT ?? DEFAULT_PORT)
const dataDir = process.env.OPERO_DATA_DIR ?? join(process.cwd(), "data")
const mode = process.env.MODEL ?? "live"
const plannerModel = process.env.OPERO_PLANNER_MODEL ?? DEFAULT_MODEL
const actorModel = process.env.OPERO_ACTOR_MODEL ?? DEFAULT_MODEL
const root = dirname(fileURLToPath(import.meta.url))
const pagePath = join(root, "../../public/index.html")

await ensureVaultKey(dataDir)
let xaiKey = mode === "fake" ? "fake" : await loadXaiKey(dataDir)

const saved = await openHouse(dataDir)
let house = saved.house
const vault = new Vault(house.vaultPath, loadKey(process.env.OPERO_VAULT_KEY!))
await vault.load().catch(() => undefined)

const browserbaseKey = mode === "fake" ? null : await loadBrowserbaseKey(dataDir)
const computer: Computer = mode === "fake" ? new FakeComputer(house.profileDir) : await openChrome(dataDir)
if (computer instanceof FakeComputer) computer.text = "plan ready"

function fakePlanner(): Planner {
  return {
    async plan({ request }) {
      return {
        type: "plan",
        end: "plan ready",
        outcome: "read",
        steps: [{
          id: "s1",
          text: request,
          site: "the site named in the mission",
          doneWhen: "plan ready",
          commit: false,
          status: "pending",
          pause: false,
          userPause: false,
        }],
      }
    },
    async review() {
      return { type: "approve" }
    },
    async converse() {
      return { type: "reply", text: "Still on the current mission." }
    },
  }
}

function fakeExecutor(): Executor {
  return { async next() { return { type: "done", evidence: "plan ready" } } }
}

function missingKeyPlanner(): Planner {
  return {
    async plan() {
      throw new Error(MISSING_GROK_KEY)
    },
    async review() {
      return { type: "ask", question: MISSING_GROK_KEY_ASK, reason: "machine" }
    },
    async converse() {
      return { type: "reply", text: MISSING_GROK_KEY_SHORT }
    },
  }
}

function missingKeyExecutor(): Executor {
  return {
    async next() {
      throw new Error(MISSING_GROK_KEY)
    },
  }
}

function liveBrain(): { planner: Planner; executor: Executor } {
  return {
    planner: createPlanner(plannerModel),
    executor: createExecutor(actorModel),
  }
}

function currentBrain(): { planner: Planner; executor: Executor } {
  if (mode === "fake") return { planner: fakePlanner(), executor: fakeExecutor() }
  if (!xaiKey) return { planner: missingKeyPlanner(), executor: missingKeyExecutor() }
  return liveBrain()
}

const brain = currentBrain()
const sockets = new Set<WebSocket>()

function send(socket: WebSocket, event: unknown): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event))
}

function broadcast(event: unknown): void {
  for (const socket of sockets) send(socket, event)
}

function readyState(): { type: "ready"; ready: boolean; mode: string } {
  return { type: "ready", ready: mode === "fake" || Boolean(xaiKey), mode }
}

function vaultState(): { type: "vault"; items: string[] } {
  return { type: "vault", items: vault.descriptions() }
}

const workStatus = createStatusBoard()
const trace = createTraceWriter(dataDir)
let lastActivityMs = saved.runtime?.lastActivityMs ?? Date.now()

const { store: conversation, abortedLeftover } = await openConversation(dataDir, {
  mission: saved.mission,
  lastActivityMs,
})

function touchActivity(): void {
  lastActivityMs = Date.now()
  loop.touchActivity(lastActivityMs)
}

function persist(): void {
  const runtime = {
    ...loop.runtimeState(),
    lastActivityMs,
  }
  void saveHouse(dataDir, house, loop.mission, runtime)
}

if (abortedLeftover) {
  void saveHouse(dataDir, house, abortedLeftover, {
    driver: saved.runtime?.driver ?? "agent",
    notes: saved.runtime?.notes ?? [],
    recent: saved.runtime?.recent ?? [],
    previousAction: saved.runtime?.previousAction ?? null,
    previousUrl: saved.runtime?.previousUrl ?? "",
    lastActivityMs,
  })
}

function restoreSavedMission(savedMission: Mission | null): void {
  if (!savedMission || !isLiveMission(savedMission)) return
  let mission = savedMission
  if (mission.lastCommit?.outcome === "started") {
    mission = markCommitUnknown(mission)
  }
  if (mission.status === "running") {
    mission = {
      ...mission,
      status: "waiting_on_user",
      question: RESTART_QUESTION,
      questionReason: "machine",
    }
  }
  loop.restoreMission(mission, {
    ...saved.runtime,
    lastActivityMs,
  })
}

const loop = new HouseLoop({
  planner: brain.planner,
  executor: brain.executor,
  computer,
  vault,
  level: house.level,
  language: house.language,
  status: workStatus,
  trace,
  recentThread: () => conversation.recentThread(),
  emit(event: LoopEvent) {
    touchActivity()
    if (event.type === "message") {
      void conversation.appendMessage(event.role, event.text, loop.mission?.id ?? null)
    }
    if (event.type === "question") {
      void conversation.appendMessage("agent", event.question, loop.mission?.id ?? null)
    }
    if ((event.type === "plan" || event.type === "status") && loop.mission) {
      void conversation.saveMission(loop.mission)
    }
    broadcast(event)
    persist()
  },
})

const liveFromConversation = [...conversation.snapshot().missions].reverse().find((mission) => isLiveMission(mission))
restoreSavedMission(liveFromConversation ?? null)
loop.abortIfQuiet(Date.now())
if (loop.mission && isLiveMission(loop.mission)) {
  void conversation.saveMission(loop.mission)
}
if (
  loop.mission &&
  (loop.mission.status === "waiting_on_user" || loop.mission.status === "running") &&
  graceOpen(Date.now(), lastActivityMs)
) {
  void loop.reconcileAfterRestart().then(() => persist())
}

const server = createServer(async (_request, response) => {
  const html = await readFile(pagePath)
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  response.end(html)
})

const wss = new WebSocketServer({ server })
wss.on("connection", (socket) => {
  sockets.add(socket)
  send(socket, { type: "labels", language: house.language, labels: labels[house.language] })
  send(socket, {
    type: "settings",
    level: house.level,
    language: house.language,
    workStatusPollMs: WORK_STATUS_POLL_MS,
  })
  send(socket, readyState())
  send(socket, vaultState())
  send(socket, {
    type: "thread",
    messages: conversation.snapshot().messages.map((message) => ({
      role: message.role,
      text: message.text,
    })),
  })
  if (loop.mission) send(socket, { type: "plan", mission: loop.mission })
  else {
    const lastMission = [...conversation.snapshot().missions].at(-1)
    if (lastMission) send(socket, { type: "plan", mission: lastMission })
  }
  socket.on("message", (raw) => {
    void onMessage(socket, String(raw))
  })
  socket.on("close", () => sockets.delete(socket))
})

async function onMessage(socket: WebSocket, raw: string): Promise<void> {
  const event = JSON.parse(raw) as {
    type: string
    text?: string
    end?: string
    level?: Level
    language?: Language
    x?: number
    y?: number
    key?: string
    direction?: "up" | "down"
    description?: string
    value?: string
  }
  if (event.type === "save_key" && typeof event.key === "string") {
    await handleSaveKey(socket, event.key.trim())
    return
  }
  if (event.type === "vault_list") {
    send(socket, vaultState())
    return
  }
  if (event.type === "vault_save" && typeof event.description === "string" && typeof event.value === "string") {
    const description = event.description.trim()
    const value = event.value
    if (!description || !value) {
      send(socket, { type: "vault_result", ok: false, message: "Add a description and a value." })
      return
    }
    await vault.save(description, value)
    broadcast(vaultState())
    send(socket, { type: "vault_result", ok: true, message: "Saved." })
    return
  }
  if (event.type === "vault_remove" && typeof event.description === "string") {
    const ok = await vault.remove(event.description)
    broadcast(vaultState())
    send(socket, { type: "vault_result", ok, message: ok ? "Removed." : "Not found." })
    return
  }
  if ((event.type === "mission" || event.type === "steer" || event.type === "answer") && event.text) {
    if (mode !== "fake" && !xaiKey) {
      send(socket, { type: "message", role: "agent", text: MISSING_GROK_KEY_SHORT })
      return
    }
    touchActivity()
    loop.level = house.level
    loop.language = house.language
    await loop.acceptMission(event.text)
  }
  if (event.type === "edit_end" && event.end) loop.editEnd(event.end)
  if (event.type === "level" && (event.level === 1 || event.level === 2)) {
    house = withSettings(house, event.level, house.language)
    loop.level = event.level
    persist()
  }
  if (event.type === "language" && (event.language === "en" || event.language === "he")) {
    house = withSettings(house, house.level, event.language)
    loop.language = event.language
    persist()
    broadcast({ type: "labels", language: event.language, labels: labels[event.language] })
  }
  if (event.type === "driver" && (event.text === "user" || event.text === "agent")) {
    loop.setDriver(event.text)
    broadcast({ type: "driver", driver: event.text })
    if (event.text === "agent") await loop.resume()
  }
  if (event.type === "work_status") {
    send(socket, { type: "work_status", status: workStatus.get() })
    return
  }
  if (loop.driver !== "user") return
  try {
    if (event.type === "click" && typeof event.x === "number" && typeof event.y === "number") {
      await computer.pointer(event.x, event.y)
    }
    if (event.type === "scroll" && (event.direction === "up" || event.direction === "down")) {
      await computer.userScroll(event.direction)
    }
    if (event.type === "type" && event.text) await computer.userType(event.text)
    if (event.type === "press" && event.key) await computer.userPress(event.key)
  } catch (error) {
    send(socket, {
      type: "message",
      role: "agent",
      text: error instanceof Error ? error.message : "The computer did not take that input.",
    })
  }
}

async function handleSaveKey(socket: WebSocket, key: string): Promise<void> {
  if (mode === "fake") {
    send(socket, { type: "key_result", ok: true, message: "Fake mode does not need a key." })
    send(socket, readyState())
    return
  }
  if (!key) {
    send(socket, { type: "key_result", ok: false, message: "Paste a Grok API key." })
    return
  }
  send(socket, { type: "key_result", ok: null, message: "Checking key…" })
  try {
    const result = await verifyXaiKey(key)
    if (!result.ok) {
      send(socket, {
        type: "key_result",
        ok: false,
        message: `Key rejected (${result.status}). ${result.detail}`.trim(),
      })
      return
    }
    await saveXaiKey(dataDir, key)
    xaiKey = key
    const next = liveBrain()
    loop.setBrain(next.planner, next.executor)
    send(socket, { type: "key_result", ok: true, message: "Key saved on this machine." })
    broadcast(readyState())
  } catch (error) {
    send(socket, {
      type: "key_result",
      ok: false,
      message: error instanceof Error ? error.message : "Could not check the key.",
    })
  }
}

setInterval(() => {
  const status = loop.mission?.status
  if (status !== "running" && status !== "waiting_on_user") return
  void computer
    .screenshot()
    .then((image) => {
      if (image.length === 0) return
      const size = jpegSize(image) ?? { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
      broadcast({ type: "screen", image: image.toString("base64"), width: size.width, height: size.height })
    })
    .catch(() => undefined)
}, SCREEN_INTERVAL_MS)

setInterval(() => {
  void loop.supervise().catch(() => undefined)
}, SUPERVISE_POLL_MS)

setInterval(() => {
  if (loop.abortIfQuiet(Date.now())) {
    persist()
    return
  }
  if (graceOpen(Date.now(), lastActivityMs)) return
  const status = loop.mission?.status
  if (status === "running") return
  void computer.close().catch(() => undefined)
}, GRACE_POLL_MS)

async function shutdown(): Promise<void> {
  const runtime = { ...loop.runtimeState(), lastActivityMs }
  await saveHouse(dataDir, house, loop.mission, runtime).catch(() => undefined)
  await computer.close().catch(() => undefined)
  server.close()
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0))
})
process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0))
})

server.listen(port, BIND_HOST, () => {
  const waiting = [
    xaiKey || mode === "fake" ? "" : "waiting for Grok key",
    browserbaseKey || mode === "fake" ? "" : "waiting for Browserbase key",
  ].filter(Boolean)
  console.log(`Opero Home → http://${BIND_HOST}:${port} (${mode}${waiting.length ? `, ${waiting.join(", ")}` : ""})`)
})

export { server }
