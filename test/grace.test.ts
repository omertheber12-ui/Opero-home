import { describe, expect, it } from "vitest"
import { GRACE_MS, graceDeadline, graceOpen } from "../src/domain/grace.js"

describe("grace", () => {
  it("stays open until ten minutes after the last activity", () => {
    expect(graceOpen(GRACE_MS - 1, 0)).toBe(true)
    expect(graceOpen(GRACE_MS, 0)).toBe(false)
    expect(graceDeadline(5_000)).toBe(5_000 + GRACE_MS)
    expect(graceOpen(GRACE_MS, 1)).toBe(true)
  })
})
