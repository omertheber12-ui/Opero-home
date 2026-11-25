import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("house page", () => {
  it("sends every chat line as mission and polls work status", async () => {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8")
    expect(html).toContain('send({ type: "mission", text })')
    expect(html).not.toContain('waiting ? "answer"')
    expect(html).toContain('send({ type: "work_status" })')
  })

  it("has every label in English and Hebrew", async () => {
    const { labels } = await import("../labels.js")
    expect(Object.keys(labels.he).sort()).toEqual(Object.keys(labels.en).sort())
  })

  it("asks the house agent for a read-only insurance check", async () => {
    const { labels } = await import("../labels.js")
    for (const text of [labels.en, labels.he]) {
      expect(text.insuranceMission).toContain("https://harb.cma.gov.il")
    }
    expect(labels.en.insuranceMission).toContain("Do not change, cancel or buy anything.")
  })
})
