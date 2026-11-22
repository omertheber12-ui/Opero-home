import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { AgentFrozen, FakeComputer } from "../src/computer/computer.js"

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
})
