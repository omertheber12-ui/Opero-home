import type { AgentAction, AskReason } from "./types.js"

const WRONG_DETAIL = /wrong password|incorrect password|invalid card|card was declined|account (locked|disabled)/i
const HUMAN_PROOF = /passkey|authenticator|sign in with google|approve in (your|the) app|magic link/i

export function forceAsk(pageText: string, action: AgentAction, secrets: string[]): AskReason | null {
  if (action.type === "type" && secrets.some((secret) => secret.length > 0 && action.text.includes(secret))) {
    return "secret"
  }
  if (action.type === "fill_detail" && WRONG_DETAIL.test(pageText)) return "wrong_detail"
  if ((action.type === "click" || action.type === "type") && action.commit && HUMAN_PROOF.test(pageText)) {
    return "code"
  }
  return null
}
