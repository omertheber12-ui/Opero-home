import { describe, expect, it } from "vitest"
import { blankMission, withPlan } from "../src/domain/mission.js"
import {
  actionFingerprint,
  consequential,
  decidePolicy,
  grantApproval,
  parseApprovalReply,
  pauseBlocks,
  wrongAccount,
} from "../src/domain/policy.js"
import type { Step } from "../src/domain/types.js"

function step(overrides: Partial<Step> = {}): Step {
  return {
    id: "s1",
    text: "Open the page",
    site: "https://example.com",
    doneWhen: "done",
    commit: false,
    status: "pending",
    pause: false,
    userPause: false,
    ...overrides,
  }
}

describe("policy", () => {
  it("treats a Pay button as consequential even when commit is false", () => {
    const action = { type: "click" as const, ref: 1, commit: false }
    expect(consequential(action, "Pay now", "read", step())).toBe(true)
    expect(consequential(action, "Next article", "read", step())).toBe(false)
  })

  it("does not treat fill_detail as consequential", () => {
    expect(consequential({ type: "fill_detail", description: "card" }, "Card", "transact", step())).toBe(false)
  })

  it("blocks a paused pending step", () => {
    const mission = withPlan(blankMission("m1", "go", 2), "end", [step({ pause: true })])
    expect(pauseBlocks(mission)).toBe(true)
    const decision = decidePolicy({
      mission,
      action: { type: "goto", url: "https://example.com" },
      url: "about:blank",
      controlName: "",
      pageText: "",
    })
    expect(decision.kind).toBe("ask_pause")
  })

  it("asks on level 1 when the control is named Pay and commit is false", () => {
    const mission = withPlan(blankMission("m1", "pay bill", 1), "end", [step()])
    const action = { type: "click" as const, ref: 3, commit: false }
    const decision = decidePolicy({
      mission,
      action,
      url: "https://pay.example",
      controlName: "Pay",
      pageText: "",
    })
    expect(decision.kind).toBe("ask_commit")
    if (decision.kind === "ask_commit") {
      expect(decision.fingerprint).toBe(actionFingerprint("https://pay.example", action, "Pay"))
    }
  })

  it("grants a one-time approval only for a clear yes", () => {
    expect(parseApprovalReply("yes")).toBe("yes")
    expect(parseApprovalReply("כן")).toBe("yes")
    expect(parseApprovalReply("no")).toBe("no")
    expect(parseApprovalReply("try the other button")).toBe("guidance")
    const fingerprint = actionFingerprint("https://a", { type: "click", ref: 1, commit: true }, "Submit")
    const pending = {
      ...withPlan(blankMission("m1", "go", 1), "end", [step()]),
      approval: { fingerprint, status: "pending" as const },
    }
    expect(grantApproval(pending, "yes").approval?.status).toBe("granted")
    expect(grantApproval(pending, "no").approval).toBeNull()
    expect(grantApproval(pending, "use the other account").approval?.status).toBe("pending")
  })

  it("refuses another commit while the last outcome is unknown", () => {
    const mission = {
      ...withPlan(blankMission("m1", "go", 2), "end", [step()]),
      lastCommit: { fingerprint: "x", outcome: "unknown" as const },
    }
    const decision = decidePolicy({
      mission,
      action: { type: "click", ref: 1, commit: true },
      url: "https://a",
      controlName: "Submit",
      pageText: "",
    })
    expect(decision.kind).toBe("ask_unknown")
  })

  it("detects a wrong account email on the page", () => {
    expect(wrongAccount("Pay as alice@home.test", "Signed in as bob@work.test")).toContain("alice@home.test")
    expect(wrongAccount("Pay as alice@home.test", "Signed in as alice@home.test")).toBeNull()
    expect(wrongAccount("Pay the bill", "Signed in as bob@work.test")).toBeNull()
  })
})
