import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { explainLiteral, explainMessage, flatCalls, loadContract, renderTypeSection, typeSection } from "../contract.mjs"
import { readFrame } from "../read-frame.mjs"

const contract = loadContract()

describe("page socket contract", () => {
  it("ignores a bad frame and keeps an unknown type", () => {
    expect(readFrame("{")).toBeNull()
    expect(readFrame("[]")).toBeNull()
    expect(readFrame(JSON.stringify({ type: "not-a-real-type" }))).toEqual({ type: "not-a-real-type" })
  })

  it("sends only contract types with contract shapes", async () => {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8")
    expect(html).toContain('import { readFrame } from "./read-frame.mjs"')
    expect(html).not.toContain("JSON.parse(event.data)")
    const calls = flatCalls(html)
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(explainLiteral(contract.pageToHouse, call), JSON.stringify(call)).toBeNull()
    }
    for (const alias of contract.houseInboundAliases) {
      expect(calls.some((call) => call.type === alias)).toBe(false)
    }
  })

  it("rejects a field whose shape changed", () => {
    expect(explainMessage(contract.pageToHouse, { type: "mission", text: 1 })).toBe("mission.text should be string")
  })

  it("keeps the generated type tables equal to the JSON", async () => {
    const markdown = await readFile(new URL("../CONTRACT.md", import.meta.url), "utf8")
    expect(typeSection(markdown)).toBe(renderTypeSection(contract))
  })
})
