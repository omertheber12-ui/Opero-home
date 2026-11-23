/** Google's "unusual traffic" sorry page, or the Chrome bar that advertises an automated launch. */
export function isGoogleChallenge(url: string, text: string): boolean {
  const haystack = `${url}\n${text}`
  return (
    /google\.[^/\s]+\/sorry/i.test(url) ||
    /unusual traffic from your computer network/i.test(haystack) ||
    /unsupported command-line flag/i.test(haystack)
  )
}

/** Strong bot-check signals. A lone "just a moment" is not enough. */
export function isBotChallenge(url: string, text: string): boolean {
  if (isGoogleChallenge(url, text)) return true
  const haystack = `${url}\n${text}`
  return (
    /challenges\.cloudflare\.com/i.test(haystack) ||
    /cf-turnstile/i.test(haystack) ||
    /cdn-cgi\/challenge-platform/i.test(haystack) ||
    /performing security verification/i.test(haystack) ||
    /verify you are human/i.test(haystack)
  )
}
