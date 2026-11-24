import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { WebSocket } from "ws"

describe("house socket stays open", () => {
  it("accepts an unknown type and a frame that is not JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-house-"))
    const port = await freePort()
    const child = spawn("node", ["node_modules/tsx/dist/cli.mjs", "src/chat/server.ts"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...process.env,
        MODEL: "fake",
        PORT: String(port),
        OPERO_DATA_DIR: dir,
        OPERO_VAULT_KEY: Buffer.alloc(32, 7).toString("base64"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let log = ""
    child.stdout?.on("data", (chunk: Buffer) => {
      log += chunk.toString()
    })
    child.stderr?.on("data", (chunk: Buffer) => {
      log += chunk.toString()
    })
    try {
      await waitForListen(child, () => log, port)
      const socket = new WebSocket(`ws://127.0.0.1:${port}`)
      await once(socket, "open")
      socket.send("not-json")
      socket.send(JSON.stringify({ type: "not-a-real-type" }))
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(socket.readyState, log).toBe(WebSocket.OPEN)
      expect(child.exitCode, log).toBeNull()
      socket.close()
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL")
        await once(child, "exit")
      }
      await rm(dir, { recursive: true, force: true })
    }
  }, 20_000)
})

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address()
      const port = typeof address === "object" && address ? address.port : 0
      probe.close(() => resolve(port))
    })
    probe.on("error", reject)
  })
}

async function waitForListen(child: ReturnType<typeof spawn>, readLog: () => string, port: number): Promise<void> {
  const started = Date.now()
  const needle = `http://127.0.0.1:${port}`
  while (Date.now() - started < 15_000) {
    if (child.exitCode !== null) throw new Error(readLog() || "house exited")
    if (readLog().includes(needle)) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(readLog() || "house did not listen")
}
