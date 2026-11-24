export function readFrame(raw) {
  let value
  try {
    value = JSON.parse(String(raw))
  } catch {
    return null
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  if (typeof value.type !== "string" || value.type.length === 0) return null
  return value
}
