import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("house page", () => {
  it("sends every chat line as mission and polls work status", async () => {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8")
    expect(html).toContain('send({ type: "mission", text })')
    expect(html).not.toContain('waiting ? "answer"')
    expect(html).toContain('send({ type: "work_status" })')
  })
})
