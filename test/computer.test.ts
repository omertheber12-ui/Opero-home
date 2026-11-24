import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import type { Browser, BrowserContext, Page } from "playwright"
import { AgentFrozen, FakeComputer } from "../src/computer/computer.js"
import { openChrome } from "../src/computer/playwright-computer.js"

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("computer", () => {
  it("refuses agent actions while the user has the screen and keeps the profile", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-profile-"))
    dirs.push(dir)
    const computer = new FakeComputer(dir)
    computer.setDriver("user")
    await expect(computer.click(1, 1)).rejects.toBeInstanceOf(AgentFrozen)
    computer.setDriver("agent")
    await computer.close()
    const info = await stat(dir)
    expect(info.isDirectory()).toBe(true)
  })

  it("clicks and types by control number one character at a time", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-profile-"))
    dirs.push(dir)
    const computer = new FakeComputer(dir)
    computer.controls = [{ ref: 4, role: "textbox", name: "Search" }]
    await computer.typeRef(4, "hi")
    expect(computer.calls).toContain("typeRef:4")
    expect(computer.typedChars).toEqual(["h", "i"])
    await expect(computer.clickRef(99)).rejects.toThrow(/not on this page/)
  })

  it("opens a new session when the stored page is already closed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-cloud-"))
    dirs.push(dir)
    let connects = 0
    let releases = 0
    const sessions: Array<{ pageClosed: boolean; dropped: boolean }> = []
    const api = {
      async createContext() {
        return { id: "ctx" }
      },
      async createSession() {
        return { id: `s${connects + 1}`, connectUrl: `ws://s${connects + 1}` }
      },
      async liveView() {
        return "https://live.example/view"
      },
      async release() {
        releases += 1
      },
    }
    const connect = async () => {
      connects += 1
      const state = { pageClosed: false, dropped: false }
      sessions.push(state)
      const page = {
        isClosed: () => state.pageClosed,
        async setViewportSize() {
          return undefined
        },
      } as unknown as Page
      const context = {
        pages: () => [page],
        async newPage() {
          return page
        },
      } as unknown as BrowserContext
      const browser = {
        isConnected: () => !state.dropped,
        async close() {
          state.dropped = true
        },
        contexts: () => [context],
        async newContext() {
          return context
        },
      } as unknown as Browser
      return browser
    }
    const computer = await openChrome(dir, { api, connect, projectId: "p" })
    await computer.wake()
    expect(connects).toBe(1)
    const first = sessions[0]
    if (!first) throw new Error("missing session")
    first.pageClosed = true
    await computer.wake()
    expect(connects).toBe(2)
    expect(releases).toBe(1)
    await computer.wake()
    expect(connects).toBe(2)
    await computer.close()
  })
})
