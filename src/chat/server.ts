import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { WebSocketServer, type WebSocket } from "ws"
import { HouseLoop, type LoopEvent } from "../agent/loop.js"
import { createExecutor, type Executor } from "../agent/executor.js"
import { createPlanner, type Planner } from "../agent/planner.js"
import { loadEnvFile } from "../boot/env.js"
import { ensureVaultKey, loadBrowserbaseKey, loadXaiKey, saveXaiKey, verifyXaiKey } from "../boot/secrets.js"
import { FakeComputer } from "../computer/computer.js"
import { openChrome } from "../computer/playwright-computer.js"
import type { Computer } from "../computer/computer.js"
import type { Language, Level } from "../domain/types.js"
import { labels } from "./i18n.js"
import { openHouse, saveHouse, withSettings } from "../store/house-store.js"
import { loadKey, Vault } from "../vault/vault.js"

await loadEnvFile()

const port = Number(process.env.PORT ?? 8787)
const dataDir = process.env.OPERO_DATA_DIR ?? join(process.cwd(), "data")
const mode = process.env.MODEL ?? "live"
const plannerModel = process.env.OPERO_PLANNER_MODEL ?? "grok-4.7"
const actorModel = process.env.OPERO_ACTOR_MODEL ?? "grok-4.7"
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
        end: "plan ready",
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
  }
}

function fakeExecutor(): Executor {
  return { async next() { return { type: "done", evidence: "plan ready" } } }
}

function missingKeyPlanner(): Planner {
  return {
    async plan() {
      throw new Error("Add your Grok API key in the setup card to run live missions.")
    },
    async review() {
      return { type: "ask", question: "Add your Grok API key first.", reason: "machine" }
    },
  }
}

function missingKeyExecutor(): Executor {
  return {
    async next() {
      throw new Error("Add your Grok API key in the setup card to run live missions.")
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

const loop = new HouseLoop({
  planner: brain.planner,
  executor: brain.executor,
  computer,
  vault,
  level: house.level,
  language: house.language,
  emit(event: LoopEvent) {
    broadcast(event)
    void saveHouse(dataDir, house, loop.mission)
  },
})

const server = createServer(async (_request, response) => {
  const html = await readFile(pagePath)
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  response.end(html)
})

const wss = new WebSocketServer({ server })
wss.on("connection", (socket) => {
  sockets.add(socket)
  send(socket, { type: "labels", language: house.language, labels: labels[house.language] })
  send(socket, { type: "settings", level: house.level, language: house.language })
  send(socket, readyState())
  send(socket, vaultState())
  if (loop.mission) send(socket, { type: "plan", mission: loop.mission })
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
  if (event.type === "mission" && event.text) {
    if (mode !== "fake" && !xaiKey) {
      send(socket, { type: "message", role: "agent", text: "Add your Grok API key in the setup card first." })
      return
    }
    loop.level = house.level
    loop.language = house.language
    await loop.acceptMission(event.text)
  }
  if (event.type === "answer" && event.text) await loop.answer(event.text)
  if (event.type === "edit_end" && event.end) loop.editEnd(event.end)
  if (event.type === "level" && (event.level === 1 || event.level === 2)) {
    house = withSettings(house, event.level, house.language)
    loop.level = event.level
    await saveHouse(dataDir, house, loop.mission)
  }
  if (event.type === "language" && (event.language === "en" || event.language === "he")) {
    house = withSettings(house, house.level, event.language)
    loop.language = event.language
    await saveHouse(dataDir, house, loop.mission)
    broadcast({ type: "labels", language: event.language, labels: labels[event.language] })
  }
  if (event.type === "driver" && (event.text === "user" || event.text === "agent")) {
    loop.setDriver(event.text)
    broadcast({ type: "driver", driver: event.text })
    if (event.text === "agent") await loop.resume()
  }
  if (event.type === "click" && loop.driver === "user" && typeof event.x === "number" && typeof event.y === "number") {
    await computer.pointer(event.x, event.y).catch(() => undefined)
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
      broadcast({ type: "screen", image: image.toString("base64") })
    })
    .catch(() => undefined)
}, 1000)

server.listen(port, "127.0.0.1", () => {
  const waiting = [
    xaiKey || mode === "fake" ? "" : "waiting for Grok key",
    browserbaseKey || mode === "fake" ? "" : "waiting for Browserbase key",
  ].filter(Boolean)
  console.log(`Opero Home → http://127.0.0.1:${port} (${mode}${waiting.length ? `, ${waiting.join(", ")}` : ""})`)
})

export { server }
