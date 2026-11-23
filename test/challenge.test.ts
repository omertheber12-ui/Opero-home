import { describe, expect, it } from "vitest"
import { isBotChallenge } from "../src/computer/challenge.js"

describe("bot challenge", () => {
  it("recognizes Google, Cloudflare, and a security verification page", () => {
    expect(isBotChallenge("https://www.google.com/sorry/index", "")).toBe(true)
    expect(isBotChallenge("https://example.com", "Our systems have detected unusual traffic from your computer network")).toBe(true)
    expect(isBotChallenge("https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile", "")).toBe(true)
    expect(isBotChallenge("https://www.gov.il/", "www.gov.il\nPerforming security verification")).toBe(true)
    expect(isBotChallenge("https://news.example/", "Verify you are human")).toBe(true)
    expect(isBotChallenge("https://news.example/", '<div class="cf-turnstile"></div>')).toBe(true)
  })

  it("does not treat a slow page as a bot check", () => {
    expect(isBotChallenge("https://news.example/", "Just a moment…")).toBe(false)
    expect(isBotChallenge("https://example.com", "Example Domain")).toBe(false)
  })
})
