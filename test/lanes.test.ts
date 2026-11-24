import { describe, expect, it } from "vitest"
import { laneError } from "../scripts/check-lanes.mjs"

describe("pull request lanes", () => {
  it("allows a page diff and a house diff", () => {
    expect(laneError(["frontend/index.html", "frontend/labels.js"])).toBeNull()
    expect(laneError(["src/chat/server.ts", "test/socket-open.test.ts"])).toBeNull()
  })

  it("allows a contract diff that also updates the verify skill", () => {
    expect(
      laneError([
        "frontend/socket-contract.json",
        "frontend/CONTRACT.md",
        "frontend/contract.mjs",
        ".cursor/skills/verify-opero/features/frontend-split.md",
      ]),
    ).toBeNull()
  })

  it("refuses a mix of page and house, and a contract edit inside a feature", () => {
    expect(laneError(["frontend/index.html", "src/chat/server.ts"])).toMatch(/mixes the page and the house/)
    expect(laneError(["frontend/index.html", "frontend/socket-contract.json"])).toMatch(/contract/)
    expect(laneError(["src/agent/loop.ts", "frontend/CONTRACT.md"])).toMatch(/contract/)
  })
})
