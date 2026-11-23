/** Google's "unusual traffic" sorry page, or the Chrome bar that advertises an automated launch. */
export function isGoogleChallenge(url: string, text: string): boolean {
  const haystack = `${url}\n${text}`
  return (
    /google\.[^/\s]+\/sorry/i.test(url) ||
    /unusual traffic from your computer network/i.test(haystack) ||
    /unsupported command-line flag/i.test(haystack)
  )
}
