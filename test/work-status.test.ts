import { describe, expect, it } from "vitest"
import { createStatusBoard } from "../src/agent/work-status.js"

describe("work status", () => {
  it("stores the latest snapshot without waiting", () => {
    const board = createStatusBoard()
    expect(board.get()).toBeNull()
    board.set({
      missionId: "m1",
      phase: "browsing",
      stepHint: "Open the site",
      lastAction: "goto",
      challenge: false,
      updatedAt: 1,
      detail: "Reading the page",
    })
    expect(board.get()?.phase).toBe("browsing")
    board.set({
      missionId: "m1",
      phase: "challenge",
      stepHint: "Open the site",
      lastAction: "",
      challenge: true,
      updatedAt: 2,
      detail: "Bot check",
    })
    expect(board.get()?.challenge).toBe(true)
  })
})
