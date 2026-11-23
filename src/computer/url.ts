/** Turn a site field into a navigable http(s) URL, or null if it cannot. */
export function toHttpUrl(site: string): string | null {
  const raw = site.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^[\w.-]+\.[a-z]{2,}([/:].*)?$/i.test(raw)) return `https://${raw}`
  return null
}

export function isBlankUrl(url: string): boolean {
  const value = url.trim().toLowerCase()
  return value === "" || value === "about:blank" || value === "chrome://newtab/" || value.startsWith("chrome://new-tab")
}
