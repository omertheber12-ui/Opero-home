const STRONG_LINE = 24
const RECOVERED_CORE = 35
const SINGLE_QUOTE = 40
const HEADLINE_MIN = 28
const HEADLINE_MAX = 220
const HEADLINE_CAP = 6

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "among",
  "because",
  "before",
  "being",
  "between",
  "could",
  "does",
  "doing",
  "during",
  "each",
  "from",
  "have",
  "having",
  "into",
  "just",
  "latest",
  "like",
  "make",
  "more",
  "most",
  "news",
  "only",
  "other",
  "over",
  "please",
  "same",
  "should",
  "some",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "until",
  "very",
  "want",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
  "find",
  "show",
  "tell",
  "give",
  "bring",
  "fetch",
  "open",
  "page",
  "site",
  "http",
  "https",
  "www",
])

/** True when every substantial line of evidence appears on the page (strict). */
export function evidenceOnPage(pageText: string, evidence: string): boolean {
  const page = normalizeText(pageText)
  const lines = evidence
    .split("\n")
    .map((line) => normalizeText(line))
    .filter((line) => line.length >= 8)
  if (lines.length === 0) {
    const single = normalizeText(evidence)
    return single.length > 0 && page.includes(single)
  }
  return lines.every((line) => page.includes(line))
}

/**
 * Keep only evidence that can be grounded on the page.
 * Uses exact lines first, then recovers page lines that contain a long chunk of the model's line.
 */
export function quotedEvidence(pageText: string, evidence: string): string | null {
  const page = normalizeText(pageText)
  const pageLines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 24)

  const rawLines = evidence
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length >= 12)

  const recovered: string[] = []
  for (const line of rawLines) {
    const norm = normalizeText(line)
    if (page.includes(norm)) {
      recovered.push(line)
      continue
    }
    const core = norm.replace(
      /^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(tember)?|oct(ober)?|nov(ember)?|dec(ember)?)\s+\d{1,2},?\s+\d{4}\s*[—\-–:]\s*/i,
      "",
    )
    const fromPage = findPageLineFor(pageLines, core.length >= RECOVERED_CORE ? core : norm)
    if (fromPage) recovered.push(fromPage)
  }

  const unique = [...new Set(recovered)]
  const strong = unique.filter((line) => line.length >= STRONG_LINE || /\d/.test(line))
  if (strong.length > 0) return strong.slice(0, HEADLINE_CAP).join("\n")
  if (unique.length >= 2) return unique.slice(0, HEADLINE_CAP).join("\n")
  if (unique.length === 1 && unique[0]!.length >= SINGLE_QUOTE) return unique[0]!

  const single = evidence.trim()
  if (single.length >= SINGLE_QUOTE && page.includes(normalizeText(single))) return single
  return null
}

/** Significant words from the mission request used to match page lines. */
export function requestKeywords(request: string): string[] {
  const words = normalizeText(request)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  const out: string[] = []
  for (const word of words) {
    if (word.length < 4) continue
    if (STOPWORDS.has(word)) continue
    if (!out.includes(word)) out.push(word)
  }
  return out
}

/**
 * Pull visible page lines that match words from the mission — used when the model paraphrases.
 * A line must hit at least two keywords, or one rare proper-noun-sized token (≥ 5 chars).
 */
export function topicLinesFromPage(pageText: string, request: string): string | null {
  const want = requestKeywords(request)
  if (want.length === 0) return null

  const rare = want.filter((word) => word.length >= 5)
  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length < HEADLINE_MIN || line.length > HEADLINE_MAX) return false
      const n = normalizeText(line)
      if (n.startsWith("skip to") || n.includes("cookie") || n.includes("subscribe")) return false
      const hits = want.filter((key) => n.includes(key))
      if (hits.length >= 2) return true
      return rare.some((key) => n.includes(key))
    })

  const unique = [...new Set(lines)].slice(0, HEADLINE_CAP)
  if (unique.length >= 2) return unique.join("\n")
  if (unique.length === 1 && unique[0]!.length >= SINGLE_QUOTE) return unique[0]!
  return null
}

export function visibleEvidence(pageText: string, end: string, doneWhen: string): string | null {
  for (const marker of [end, doneWhen]) {
    const value = marker.trim()
    if (value && evidenceOnPage(pageText, value)) return value
  }
  return null
}

/** Prefer quoted model lines, else topic lines from the mission request. */
export function groundedEvidence(pageText: string, evidence: string, request: string): string | null {
  return (
    quotedEvidence(pageText, evidence) ??
    topicLinesFromPage(pageText, request) ??
    (evidenceOnPage(pageText, evidence) ? evidence.trim() : null)
  )
}

function findPageLineFor(pageLines: string[], needle: string): string | null {
  if (needle.length < 28) return null
  for (const pl of pageLines) {
    const pn = normalizeText(pl)
    if (pn.includes(needle)) return pl
  }
  for (let len = Math.min(needle.length, 90); len >= 36; len -= 6) {
    for (let i = 0; i + len <= needle.length; i += 8) {
      const chunk = needle.slice(i, i + len)
      for (const pl of pageLines) {
        if (normalizeText(pl).includes(chunk)) return pl
      }
    }
  }
  return null
}
