import { describe, expect, it } from "vitest"
import { sessionBody } from "../src/computer/browserbase.js"
import { isGoogleChallenge } from "../src/computer/challenge.js"

describe("browserbase session body", () => {
  it("keeps captcha solving, verified mode, and proxies off", () => {
    const body = sessionBody("ctx_1")
    expect(body.keepAlive).toBe(true)
    expect(body.browserSettings.solveCaptchas).toBe(false)
    expect(body.browserSettings.verified).toBe(false)
    expect(body.browserSettings.context).toEqual({ id: "ctx_1", persist: true })
    expect("proxies" in body).toBe(false)
  })
})

describe("google challenge", () => {
  it("matches the sorry page and the sandbox banner", () => {
    expect(isGoogleChallenge("https://www.google.com/sorry/index", "")).toBe(true)
    expect(isGoogleChallenge("https://example.com", "Our systems have detected unusual traffic from your computer network")).toBe(true)
    expect(isGoogleChallenge("https://example.com", "You are using an unsupported command-line flag: --no-sandbox")).toBe(true)
    expect(isGoogleChallenge("https://example.com", "Example Domain")).toBe(false)
  })
})
