import { chromium, type Browser, type BrowserContext, type Page } from "playwright"
import { loadBrowserbaseKey } from "../boot/secrets.js"
import { AgentFrozen, type Computer, type PageSnapshot } from "./computer.js"
import { browserbaseApi, openCloudSession, type BrowserbaseApi } from "./browserbase.js"
import { collectControls } from "./snapshot.js"

const CHAR_DELAY_MS = 45
const MISSING_KEY = "Add BROWSERBASE_API_KEY to .env. Live mode uses Browserbase Chrome."

export type CloudDeps = {
  apiKey?: string
  projectId?: string
  api?: BrowserbaseApi
  connect?: (url: string) => Promise<Browser>
  fetch?: typeof fetch
}

export async function openChrome(dataDir: string, deps: CloudDeps = {}): Promise<Computer> {
  let context: BrowserContext | null = null
  let page: Page | null = null
  let browser: Browser | null = null
  let release: (() => Promise<void>) | null = null
  let liveViewUrl = ""
  let driver: "agent" | "user" = "agent"

  const freeze = () => {
    if (driver === "user") throw new AgentFrozen()
  }

  const requirePage = (): Page => {
    if (!page) throw new Error("Browser page is not open")
    return page
  }

  const typeHuman = async (text: string) => {
    const current = requirePage()
    for (const ch of text) {
      await current.keyboard.type(ch, { delay: CHAR_DELAY_MS })
    }
  }

  const moveAndClick = async (x: number, y: number) => {
    const current = requirePage()
    await current.mouse.move(x, y, { steps: 10 })
    await current.mouse.click(x, y)
  }

  const locatorFor = (ref: number) => requirePage().locator(`[data-opero-ref="${ref}"]`).first()

  return {
    async wake() {
      if (context) return
      const apiKey = deps.apiKey ?? (await loadBrowserbaseKey(dataDir))
      if (!deps.api && !apiKey) throw new Error(MISSING_KEY)
      const projectId = deps.projectId ?? process.env.BROWSERBASE_PROJECT_ID?.trim() ?? undefined
      const api = deps.api ?? browserbaseApi(apiKey ?? "", deps.fetch)
      const connect = deps.connect ?? ((url: string) => chromium.connectOverCDP(url))
      const opened = await openCloudSession(dataDir, api, connect, projectId)
      browser = opened.browser
      release = opened.release
      liveViewUrl = opened.liveView
      context = browser.contexts()[0] ?? (await browser.newContext())
      page = context.pages()[0] ?? (await context.newPage())
    },
    async close() {
      await browser?.close().catch(() => undefined)
      await release?.().catch(() => undefined)
      browser = null
      release = null
      context = null
      page = null
      liveViewUrl = ""
    },
    async screenshot() {
      if (!page) return Buffer.from("")
      try {
        return await page.screenshot({ type: "jpeg", quality: 60 })
      } catch {
        return Buffer.from("")
      }
    },
    async pageText() {
      if (!page) return ""
      return page.locator("body").innerText().catch(() => "")
    },
    async url() {
      return page?.url() ?? "about:blank"
    },
    async snapshot(): Promise<PageSnapshot> {
      if (!page) return { url: "about:blank", text: "", controls: [] }
      const [url, text, controls] = await Promise.all([
        Promise.resolve(page.url()),
        page.locator("body").innerText().catch(() => ""),
        collectControls(page).catch(() => [] as Awaited<ReturnType<typeof collectControls>>),
      ])
      return { url, text, controls }
    },
    async goto(url: string) {
      freeze()
      const current = requirePage()
      await current.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 })
      await current
        .waitForFunction(() => (document.body?.innerText?.trim().length ?? 0) >= 40, null, {
          timeout: 8000,
        })
        .catch(() => undefined)
    },
    async click(x: number, y: number) {
      freeze()
      await moveAndClick(x, y)
    },
    async clickRef(ref: number) {
      freeze()
      const target = locatorFor(ref)
      if ((await target.count()) === 0) throw new Error(`Control ${ref} is not on this page`)
      const box = await target.boundingBox()
      if (!box) throw new Error(`Control ${ref} is not visible`)
      await moveAndClick(box.x + box.width / 2, box.y + box.height / 2)
    },
    async pointer(x: number, y: number) {
      await moveAndClick(x, y)
    },
    async type(text: string) {
      freeze()
      await typeHuman(text)
    },
    async typeRef(ref: number, text: string) {
      freeze()
      const target = locatorFor(ref)
      if ((await target.count()) === 0) throw new Error(`Control ${ref} is not on this page`)
      const box = await target.boundingBox()
      if (!box) throw new Error(`Control ${ref} is not visible`)
      await moveAndClick(box.x + box.width / 2, box.y + box.height / 2)
      await typeHuman(text)
    },
    async press(key: string) {
      freeze()
      await requirePage().keyboard.press(key)
    },
    async scroll(direction: "up" | "down") {
      freeze()
      const delta = direction === "down" ? 600 : -600
      await requirePage().mouse.wheel(0, delta)
    },
    async fill(selector: string, text: string) {
      freeze()
      const current = requirePage()
      await current.locator(selector).first().click()
      await typeHuman(text)
    },
    async cookies() {
      if (!context) return []
      const cookies = await context.cookies()
      return cookies.map((cookie) => ({ name: cookie.name, value: cookie.value }))
    },
    liveView() {
      return liveViewUrl
    },
    setDriver(next) {
      driver = next
    },
  }
}
