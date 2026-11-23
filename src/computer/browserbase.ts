import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import Browserbase from "@browserbasehq/sdk"
import type { Browser } from "playwright"

export type BrowserbaseSessionBody = {
  keepAlive: true
  projectId?: string
  browserSettings: {
    solveCaptchas: false
    verified: false
    context: { id: string; persist: true }
  }
}

export type BrowserbaseApi = {
  createContext(projectId?: string): Promise<{ id: string }>
  createSession(body: BrowserbaseSessionBody): Promise<{ id: string; connectUrl: string }>
  liveView(sessionId: string): Promise<string>
  release(sessionId: string): Promise<void>
}

export function sessionBody(contextId: string, projectId?: string): BrowserbaseSessionBody {
  const body: BrowserbaseSessionBody = {
    keepAlive: true,
    browserSettings: {
      solveCaptchas: false,
      verified: false,
      context: { id: contextId, persist: true },
    },
  }
  if (projectId) body.projectId = projectId
  return body
}

export function browserbaseApi(apiKey: string, fetchImpl?: typeof fetch): BrowserbaseApi {
  const client = new Browserbase({ apiKey, fetch: fetchImpl as never, maxRetries: 0, timeout: 20000 })
  return {
    async createContext(projectId) {
      const context = await client.contexts.create(projectId ? { projectId } : {})
      return { id: context.id }
    },
    async createSession(body) {
      const session = await client.sessions.create(body)
      return { id: session.id, connectUrl: session.connectUrl }
    },
    async liveView(sessionId) {
      const urls = await client.sessions.debug(sessionId)
      return urls.debuggerFullscreenUrl || urls.debuggerUrl
    },
    async release(sessionId) {
      await client.sessions.update(sessionId, { status: "REQUEST_RELEASE" })
    },
  }
}

export async function ensureContext(dataDir: string, api: BrowserbaseApi, projectId?: string): Promise<string> {
  await mkdir(dataDir, { recursive: true })
  const path = join(dataDir, "browserbase-context.id")
  try {
    const existing = (await readFile(path, "utf8")).trim()
    if (existing) return existing
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  const created = await api.createContext(projectId)
  await writeFile(path, created.id, { mode: 0o600 })
  return created.id
}

export async function openCloudSession(
  dataDir: string,
  api: BrowserbaseApi,
  connect: (url: string) => Promise<Browser>,
  projectId?: string,
): Promise<{ browser: Browser; liveView: string; release: () => Promise<void> }> {
  const contextId = await ensureContext(dataDir, api, projectId)
  const body = sessionBody(contextId, projectId)
  const session = await api.createSession(body)
  try {
    const browser = await connect(session.connectUrl)
    let liveView = ""
    try {
      liveView = await api.liveView(session.id)
    } catch {
      liveView = ""
    }
    return {
      browser,
      liveView,
      release: () => api.release(session.id),
    }
  } catch (error) {
    await api.release(session.id).catch(() => undefined)
    throw error
  }
}
