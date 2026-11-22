import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { WebSocketServer, type WebSocket } from "ws"
import { HouseLoop, type LoopEvent } from "../agent/loop.js"
import { createExecutor, type Executor } from "../agent/executor.js"
import { createPlanner, type Planner } from "../agent/planner.js"
import { FakeComputer } from "../computer/computer.js"
import { openChrome } from "../computer/playwright-computer.js"
import type { Computer } from "../computer/computer.js"
import { graceOpen } from "../domain/grace.js"
import type { Language, Level } from "../domain/types.js"
import { labels } from "./i18n.js"
import { openHouse, saveHouse, withSettings } from "../store/house-store.js"
import { loadKey, Vault } from "../vault/vault.js"

const port = Number(process.env.PORT ?? 8787)
const dataDir = process.env.OPERO_DATA_DIR ?? join(process.cwd(), "data")
const mode = process.env.MODEL ?? "live"
const root = dirname(fileURLToPath(import.meta.url))
const pagePath = join(root, "../../public/index.html")

if (mode === "live") {
  for (const name of ["XAI_API_KEY", "OPERO_VAULT_KEY", "OPERO_ACTOR_MODEL"]) {
    if (!process.env[name]) throw new Error(`${name} is missing`)
  }
}

const saved = await openHouse(dataDir)
let house = saved.house
const vault = new Vault(house.vaultPath, loadKey(process.env.OPERO_VAULT_KEY ?? Buffer.from(new Uint8Array(32)).toString("base64")))
await vault.load().catch(() => undefined)

const computer: Computer = mode === "fake" ? new FakeComputer(house.profileDir) : await openChrome(house.profileDir, join(dataDir, "downloads"))
if (computer instanceof FakeComputer) computer.text = "plan ready"

const planner: Planner = mode === "fake"
  ? {
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
  : createPlanner(process.env.OPERO_PLANNER_MODEL ?? "grok-4.7")

const executor: Executor = mode === "fake"
  ? { async next() { return { type: "done", evidence: "plan ready" } } }
  : createExecutor(process.env.OPERO_ACTOR_MODEL ?? "")

const sockets = new Set<WebSocket>()
let lastActivityMs = Date.now()

function touch(): void {
  lastActivityMs = Date.now()
}

function send(socket: WebSocket, event: unknown): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event))
}

function broadcast(event: unknown): void {
  for (const socket of sockets) send(socket, event)
}

const loop = new HouseLoop({
  planner,
  executor,
  computer,
  vault,
  level: house.level,
  language: house.language,
  emit(event: LoopEvent) {
    if (event.type === "question" || event.type === "message") touch()
    broadcast(event)
    void saveHouse(dataDir, house, loop.mission)
  },
})

const server = createServer(async (request, response) => {
  const html = await readFile(pagePath)
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  response.end(html)
})

const wss = new WebSocketServer({ server })
wss.on("connection", (socket) => {
  sockets.add(socket)
  send(socket, { type: "labels", language: house.language, labels: labels[house.language] })
  send(socket, { type: "settings", level: house.level, language: house.language })
  if (loop.mission) send(socket, { type: "plan", mission: loop.mission })
  socket.on("message", (raw) => {
    void onMessage(socket, String(raw))
  })
  socket.on("close", () => sockets.delete(socket))
})

async function onMessage(socket: WebSocket, raw: string): Promise<void> {
  const event = JSON.parse(raw) as { type: string; text?: string; end?: string; level?: Level; language?: Language; x?: number; y?: number }
  touch()
  if (event.type === "mission" && event.text) {
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
    if (event.text === "agent") await loop.resume()
  }
  if (event.type === "click" && loop.driver === "user" && typeof event.x === "number" && typeof event.y === "number") {
    await computer.pointer(event.x, event.y).catch(() => undefined)
  }
}

setInterval(() => {
  if (!graceOpen(Date.now(), lastActivityMs) && !loop.clickInFlight) void computer.close()
}, 1000)

setInterval(() => {
  const status = loop.mission?.status
  if (status !== "running" && status !== "waiting_on_user") return
  void computer.screenshot().then((image) => {
    if (image.length === 0) return
    broadcast({ type: "screen", image: image.toString("base64") })
  })
}, 1000)

server.listen(port, "127.0.0.1")

export { server }
