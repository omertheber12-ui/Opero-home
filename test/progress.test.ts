import { describe, expect, it } from "vitest"
import {
  controlSignature,
  madeProgress,
  missionBudget,
  STALL_ACTIONS,
  STRATEGY_LIMIT,
} from "../src/domain/progress.js"

describe("progress", () => {
  it("clamps the mission budget from step count", () => {
    expect(missionBudget(1)).toBe(16)
    expect(missionBudget(3)).toBe(24)
    expect(missionBudget(10)).toBe(48)
  })

  it("detects progress from url path, done step, or control set change", () => {
    expect(
      madeProgress({
        beforeUrl: "https://a.example/one",
        afterUrl: "https://a.example/two",
        stepBecameDone: false,
        beforeControls: "button:Go",
        afterControls: "button:Go",
      }),
    ).toBe(true)
    expect(
      madeProgress({
        beforeUrl: "https://a.example/one",
        afterUrl: "https://a.example/one",
        stepBecameDone: true,
        beforeControls: "button:Go",
        afterControls: "button:Go",
      }),
    ).toBe(true)
    expect(
      madeProgress({
        beforeUrl: "https://a.example/one",
        afterUrl: "https://a.example/one",
        stepBecameDone: false,
        beforeControls: "button:Go",
        afterControls: "button:Next",
      }),
    ).toBe(true)
    expect(
      madeProgress({
        beforeUrl: "https://a.example/one",
        afterUrl: "https://a.example/one",
        stepBecameDone: false,
        beforeControls: "button:Go",
        afterControls: "button:Go",
      }),
    ).toBe(false)
  })

  it("exposes stall and strategy limits", () => {
    expect(STALL_ACTIONS).toBe(3)
    expect(STRATEGY_LIMIT).toBe(5)
    expect(controlSignature([{ ref: 1, role: "button", name: "Go" }])).toBe("button:Go")
  })
})
