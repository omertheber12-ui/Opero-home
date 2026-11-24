import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { explainLiteral, explainMessage, flatCalls, loadContract, renderTypeSection, returnedCalls, typeSection } from "../frontend/contract.mjs"
import { readFrame } from "../frontend/read-frame.mjs"
import { readSocketFrame } from "../src/chat/frame.js"

const contract = loadContract()

describe("house socket contract", () => {
  it("reads a frame the same way the page does", () => {
    const samples = ["{", "[]", JSON.stringify({ type: "not-a-real-type", extra: 1 }), JSON.stringify({ nope: true })]
    for (const sample of samples) {
      expect(readSocketFrame(sample)).toEqual(readFrame(sample))
    }
  })

  it("emits only contract types with contract shapes", async () => {
    const server = await readFile(new URL("../src/chat/server.ts", import.meta.url), "utf8")
    const loop = await readFile(new URL("../src/agent/loop.ts", import.meta.url), "utf8")
    expect(server).not.toContain('type: "labels"')
    expect(server).toContain("readSocketFrame")
    expect(server).not.toContain("JSON.parse(raw)")
    const calls = [...flatCalls(server), ...returnedCalls(server, "readyState"), ...returnedCalls(server, "vaultState"), ...flatCalls(loop)]
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(explainLiteral(contract.houseToPage, call), JSON.stringify(call)).toBeNull()
    }
  })

  it("rejects a field whose shape changed", () => {
    expect(explainMessage(contract.houseToPage, { type: "message", role: "agent", text: 1 })).toBe(
      "message.text should be string",
    )
  })

  it("keeps the generated type tables equal to the JSON", async () => {
    const markdown = await readFile(new URL("../frontend/CONTRACT.md", import.meta.url), "utf8")
    expect(typeSection(markdown)).toBe(renderTypeSection(contract))
  })
})
