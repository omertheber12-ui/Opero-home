export function readSocketFrame(raw: string): Record<string, unknown> | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const type = (value as { type?: unknown }).type
  if (typeof type !== "string" || type.length === 0) return null
  return value as Record<string, unknown>
}
