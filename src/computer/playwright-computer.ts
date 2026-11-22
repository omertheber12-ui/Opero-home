import { rm } from "node:fs/promises"
import { chromium, type BrowserContext, type Page } from "playwright"
import { AgentFrozen, type Computer } from "./computer.js"

export async function openChrome(profileDir: string, downloadDir: string): Promise<Computer> {
  let context: BrowserContext | null = null
  let page: Page | null = null
  let driver: "agent" | "user" = "agent"

  const freeze = () => {
    if (driver === "user") throw new AgentFrozen()
  }

  return {
    async wake() {
      if (context) return
      context = await chromium.launchPersistentContext(profileDir, {
        channel: "chrome",
        headless: false,
        viewport: { width: 1280, height: 800 },
        acceptDownloads: true,
        downloadsPath: downloadDir,
      })
      page = context.pages()[0] ?? (await context.newPage())
    },
    async close() {
      await context?.close()
      context = null
      page = null
      await rm(downloadDir, { recursive: true, force: true })
    },
    async screenshot() {
      if (!page) return Buffer.from("")
      return page.screenshot({ type: "jpeg", quality: 60 })
    },
    async pageText() {
      if (!page) return ""
      return page.locator("body").innerText().catch(() => "")
    },
    async url() {
      return page?.url() ?? "about:blank"
    },
    async goto(url: string) {
      freeze()
      await page?.goto(url)
    },
    async click(x: number, y: number) {
      freeze()
      await page?.mouse.click(x, y)
    },
    async pointer(x: number, y: number) {
      await page?.mouse.click(x, y)
    },
    async type(text: string) {
      freeze()
      await page?.keyboard.type(text)
    },
    async fill(selector: string, text: string) {
      freeze()
      await page?.fill(selector, text)
    },
    async cookies() {
      if (!context) return []
      const cookies = await context.cookies()
      return cookies.map((cookie) => ({ name: cookie.name, value: cookie.value }))
    },
    setDriver(next) {
      driver = next
    },
  }
}
