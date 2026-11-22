export class AgentFrozen extends Error {
  constructor() {
    super("AgentFrozen")
    this.name = "AgentFrozen"
  }
}

export type Computer = {
  wake(): Promise<void>
  close(): Promise<void>
  screenshot(): Promise<Buffer>
  pageText(): Promise<string>
  url(): Promise<string>
  goto(url: string): Promise<void>
  click(x: number, y: number): Promise<void>
  pointer(x: number, y: number): Promise<void>
  type(text: string): Promise<void>
  fill(selector: string, text: string): Promise<void>
  cookies(): Promise<Array<{ name: string; value: string }>>
  setDriver(driver: "agent" | "user"): void
}

export class FakeComputer implements Computer {
  driver: "agent" | "user" = "agent"
  calls: string[] = []
  text = ""
  currentUrl = "about:blank"
  awake = false

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

  async pageText(): Promise<string> {
    return this.text
  }

  async url(): Promise<string> {
    return this.currentUrl
  }

  async goto(url: string): Promise<void> {
    this.guard("goto")
    this.currentUrl = url
  }

  async click(x: number, y: number): Promise<void> {
    this.guard(`click:${x},${y}`)
  }

  async pointer(x: number, y: number): Promise<void> {
    this.calls.push(`pointer:${x},${y}`)
  }

  async type(text: string): Promise<void> {
    this.guard("type")
    this.text += text
  }

  async fill(selector: string, text: string): Promise<void> {
    this.guard(`fill:${selector}`)
    this.text += text
  }

  async cookies(): Promise<Array<{ name: string; value: string }>> {
    return []
  }

  setDriver(driver: "agent" | "user"): void {
    this.driver = driver
  }

  private guard(call: string): void {
    if (this.driver === "user") throw new AgentFrozen()
    this.calls.push(call)
  }
}
