import { chromium, type Browser, type BrowserContext, type Page } from "playwright"
import { loadBrowserbaseKey } from "../boot/secrets.js"
import { AgentFrozen, type Computer, type PageSnapshot } from "./computer.js"
import { browserbaseApi, openCloudSession, type BrowserbaseApi } from "./browserbase.js"
import { collectControls } from "./snapshot.js"
import {
  BLANK_URL,
  CHAR_DELAY_MS,
  MIN_PAGE_TEXT,
  MISSING_BROWSERBASE_KEY,
  NAV_TIMEOUT_MS,
  PAGE_TEXT_WAIT_MS,
  SCREENSHOT_MASK_ATTR,
  SCREENSHOT_MASK_ID_PREFIX,
  SCREENSHOT_MASK_VALUE,
  SCREENSHOT_QUALITY,
  SCROLL_DELTA,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "../config.js"

const MISSING_KEY = MISSING_BROWSERBASE_KEY

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
  let snapSeq = 0

  const freeze = () => {
    if (driver === "user") throw new AgentFrozen()
  }

  const requirePage = (): Page => {
    if (!page) throw new Error("Browser page is not open")
    return page
  }

  const wheel = async (direction: "up" | "down") => {
    const delta = direction === "down" ? SCROLL_DELTA : -SCROLL_DELTA
    await requirePage().mouse.wheel(0, delta)
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

  const sessionAlive = (): boolean => {
    if (!browser || !context || !page) return false
    try {
      if (!browser.isConnected()) return false
      return !page.isClosed()
    } catch {
      return false
    }
  }

  const dropSession = async () => {
    await browser?.close().catch(() => undefined)
    await release?.().catch(() => undefined)
    browser = null
    release = null
    context = null
    page = null
    liveViewUrl = ""
  }

  return {
    async wake() {
      if (sessionAlive()) return
      await dropSession()
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
      await page.setViewportSize({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT })
    },
    async close() {
      await dropSession()
    },
    async screenshot() {
      if (!page) return Buffer.from("")
      try {
        return await page.screenshot({ type: "jpeg", quality: SCREENSHOT_QUALITY })
      } catch {
        return Buffer.from("")
      }
    },
    async screenshotForModel(secrets: string[] = []) {
      if (!page) return Buffer.from("")
      const current = page
      await current
        .evaluate(
          ({ secretList, maskAttr, maskPrefix, maskValue }) => {
            const w = window as unknown as { __operoMask?: Array<{ id: string; value: string; type: string }> }
            const restores: Array<{ id: string; value: string; type: string }> = []
            const nodes = Array.from(document.querySelectorAll("input, textarea")) as Array<
              HTMLInputElement | HTMLTextAreaElement
            >
            nodes.forEach((el, index) => {
              const value = el.value
              const type = el instanceof HTMLInputElement ? el.type : "textarea"
              const hide =
                type === "password" || secretList.some((secret) => secret.length > 0 && value.includes(secret))
              if (!hide) return
              const id = `${maskPrefix}${index}`
              el.setAttribute(maskAttr, id)
              restores.push({ id, value, type })
              if (el instanceof HTMLInputElement && type !== "password") el.type = "password"
              el.value = maskValue
            })
            w.__operoMask = restores
          },
          {
            secretList: secrets,
            maskAttr: SCREENSHOT_MASK_ATTR,
            maskPrefix: SCREENSHOT_MASK_ID_PREFIX,
            maskValue: SCREENSHOT_MASK_VALUE,
          },
        )
        .catch(() => undefined)
      try {
        return await current.screenshot({ type: "jpeg", quality: SCREENSHOT_QUALITY })
      } catch {
        return Buffer.from("")
      } finally {
        await current
          .evaluate((maskAttr) => {
            const w = window as unknown as { __operoMask?: Array<{ id: string; value: string; type: string }> }
            for (const item of w.__operoMask ?? []) {
              const el = document.querySelector(`[${maskAttr}="${item.id}"]`) as
                | HTMLInputElement
                | HTMLTextAreaElement
                | null
              if (!el) continue
              if (el instanceof HTMLInputElement) el.type = item.type === "textarea" ? "text" : item.type
              el.value = item.value
              el.removeAttribute(maskAttr)
            }
            w.__operoMask = []
          }, SCREENSHOT_MASK_ATTR)
          .catch(() => undefined)
      }
    },
    async pageText() {
      if (!page) return ""
      return page.locator("body").innerText().catch(() => "")
    },
    async url() {
      return page?.url() ?? BLANK_URL
    },
    async snapshot(): Promise<PageSnapshot> {
      snapSeq += 1
      const id = `snap${snapSeq}`
      if (!page) return { id, url: BLANK_URL, text: "", title: "", headings: [], controls: [] }
      const [url, text, controls, shape] = await Promise.all([
        Promise.resolve(page.url()),
        page.locator("body").innerText().catch(() => ""),
        collectControls(page).catch(() => [] as Awaited<ReturnType<typeof collectControls>>),
        page
          .evaluate(() => {
            const title = (document.title || "").replace(/\s+/g, " ").trim().slice(0, 180)
            const headingTexts = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
              .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
              .filter((value) => value.length > 0)
              .slice(0, 8)
            return { title, headingTexts }
          })
          .catch(() => ({ title: "", headingTexts: [] as string[] })),
      ])
      return { id, url, text, title: shape.title, headings: shape.headingTexts, controls }
    },
    async goto(url: string) {
      freeze()
      const current = requirePage()
      await current.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS })
      await current
        .waitForFunction((min: number) => (document.body?.innerText?.trim().length ?? 0) >= min, MIN_PAGE_TEXT, {
          timeout: PAGE_TEXT_WAIT_MS,
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
      await wheel(direction)
    },
    async userType(text: string) {
      await typeHuman(text)
    },
    async userPress(key: string) {
      await requirePage().keyboard.press(key)
    },
    async userScroll(direction: "up" | "down") {
      await wheel(direction)
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
