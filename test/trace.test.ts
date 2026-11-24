import { describe, expect, it } from "vitest"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createTraceWriter, failureClass, redactDetail, summarizeTrace } from "../src/domain/trace.js"

describe("trace", () => {
  it("redacts secret values from detail text", () => {
    const detail = redactDetail({ note: "password is hunter2" }, ["hunter2"])
    expect(JSON.stringify(detail)).toContain("[secret]")
    expect(JSON.stringify(detail)).not.toContain("hunter2")
  })

  it("appends one json line per event", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-trace-"))
    const writer = createTraceWriter(dir)
    await writer.append({
      at: 1,
      missionId: "m1",
      kind: "ask",
      detail: { question: "continue?" },
    })
    await writer.append({
      at: 2,
      missionId: "m1",
      kind: "apply",
      detail: { type: "click" },
    })
    const text = await readFile(join(dir, "traces", "m1.jsonl"), "utf8")
    const lines = text.trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0]!).kind).toBe("ask")
  })

  it("summarizes counts from events", () => {
    const summary = summarizeTrace([
      { at: 1, missionId: "m1", kind: "action", detail: {} },
      { at: 2, missionId: "m1", kind: "ask", detail: {} },
      { at: 3, missionId: "m1", kind: "completion", detail: {} },
      { at: 4, missionId: "m1", kind: "rescue", detail: {} },
    ])
    expect(summary.actions).toBe(1)
    expect(summary.asks).toBe(1)
    expect(summary.completions).toBe(1)
    expect(summary.rescues).toBe(1)
  })

  it("marks an ask as reasoning and redacts a secret", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-trace-"))
    const writer = createTraceWriter(dir)
    await writer.append(
      {
        at: 1,
        missionId: "m1",
        kind: "ask",
        detail: { reason: "verify", question: "password is hunter2" },
      },
      ["hunter2"],
    )
    await writer.append({
      at: 2,
      missionId: "m1",
      kind: "rescue",
      detail: { reason: "goto_failed", failure: "navigation" },
    })
    const text = await readFile(join(dir, "traces", "m1.jsonl"), "utf8")
    const lines = text.trim().split("\n").map((line) => JSON.parse(line) as { class?: string })
    expect(lines[0]?.class).toBe("reasoning")
    expect(lines[1]?.class).toBe("site")
    expect(text).toContain("[secret]")
    expect(text).not.toContain("hunter2")
    expect(failureClass("ask", { reason: "machine" })).toBe("site")
    expect(failureClass("rescue", { reason: "budget_exhausted" })).toBe("reasoning")
  })
})
