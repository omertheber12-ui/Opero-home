import type { PageControl } from "../domain/types.js"
import { BLANK_URL, FAKE_LIVE_VIEW_URL } from "../config.js"

export class AgentFrozen extends Error {
  constructor() {
    super("AgentFrozen")
    this.name = "AgentFrozen"
  }
}

export type PageSnapshot = {
  id: string
  url: string
  text: string
  title: string
  headings: string[]
  controls: PageControl[]
}

export type Computer = {
  wake(): Promise<void>
  close(): Promise<void>
  screenshot(): Promise<Buffer>
  screenshotForModel(secrets?: string[]): Promise<Buffer>
  pageText(): Promise<string>
  url(): Promise<string>
  snapshot(): Promise<PageSnapshot>
  goto(url: string): Promise<void>
  click(x: number, y: number): Promise<void>
  clickRef(ref: number): Promise<void>
  pointer(x: number, y: number): Promise<void>
  type(text: string): Promise<void>
  typeRef(ref: number, text: string): Promise<void>
  press(key: string): Promise<void>
  scroll(direction: "up" | "down"): Promise<void>
  userType(text: string): Promise<void>
  userPress(key: string): Promise<void>
  userScroll(direction: "up" | "down"): Promise<void>
  fill(selector: string, text: string): Promise<void>
  cookies(): Promise<Array<{ name: string; value: string }>>
  liveView(): string
  setDriver(driver: "agent" | "user"): void
}

let snapSeq = 0

export class FakeComputer implements Computer {
  driver: "agent" | "user" = "agent"
  calls: string[] = []
  typedChars: string[] = []
  text = ""
  currentUrl = BLANK_URL
  awake = false
  controls: PageControl[] = []
  lastSnapshotId = ""

  constructor(readonly profileDir: string) {}

  async wake(): Promise<void> {
    this.calls.push("wake")
    this.awake = true
  }

  async close(): Promise<void> {
    this.calls.push("close")
    this.awake = false
  }

  async screenshot(): Promise<Buffer> {
    this.calls.push("screenshot")
    return Buffer.from("screenshot")
  }

  async screenshotForModel(_secrets: string[] = []): Promise<Buffer> {
    this.calls.push("screenshotForModel")
    return Buffer.from("screenshot-model")
  }

  async pageText(): Promise<string> {
    return this.text
  }

  async url(): Promise<string> {
    return this.currentUrl
  }

  async snapshot(): Promise<PageSnapshot> {
    snapSeq += 1
    this.lastSnapshotId = `snap${snapSeq}`
    return {
      id: this.lastSnapshotId,
      url: this.currentUrl,
      text: this.text,
      title: "",
      headings: [],
      controls: this.controls,
    }
  }

  async goto(url: string): Promise<void> {
    this.guard("goto")
    this.currentUrl = url
  }

  async click(x: number, y: number): Promise<void> {
    this.guard(`click:${x},${y}`)
  }

  async clickRef(ref: number): Promise<void> {
    this.guard(`clickRef:${ref}`)
    if (!this.controls.some((control) => control.ref === ref)) {
      throw new Error(`Control ${ref} is not on this page`)
    }
  }

  async pointer(x: number, y: number): Promise<void> {
    this.calls.push(`pointer:${x},${y}`)
  }

  async type(text: string): Promise<void> {
    this.guard("type")
    for (const ch of text) this.typedChars.push(ch)
    this.text += text
  }

  async typeRef(ref: number, text: string): Promise<void> {
    this.guard(`typeRef:${ref}`)
    if (!this.controls.some((control) => control.ref === ref)) {
      throw new Error(`Control ${ref} is not on this page`)
    }
    for (const ch of text) this.typedChars.push(ch)
    this.text += text
  }

  async press(key: string): Promise<void> {
    this.guard(`press:${key}`)
  }

  async scroll(direction: "up" | "down"): Promise<void> {
    this.guard(`scroll:${direction}`)
  }

  async userType(text: string): Promise<void> {
    this.calls.push(`userType:${text}`)
    for (const ch of text) this.typedChars.push(ch)
  }

  async userPress(key: string): Promise<void> {
    this.calls.push(`userPress:${key}`)
  }

  async userScroll(direction: "up" | "down"): Promise<void> {
    this.calls.push(`userScroll:${direction}`)
  }

  async fill(selector: string, text: string): Promise<void> {
    this.guard(`fill:${selector}`)
    for (const ch of text) this.typedChars.push(ch)
    this.text += text
  }

  async cookies(): Promise<Array<{ name: string; value: string }>> {
    return []
  }

  liveView(): string {
    return FAKE_LIVE_VIEW_URL
  }

  setDriver(driver: "agent" | "user"): void {
    this.driver = driver
  }

  private guard(call: string): void {
    if (this.driver === "user") throw new AgentFrozen()
    this.calls.push(call)
  }
}
