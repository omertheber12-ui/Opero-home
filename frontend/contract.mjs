import { readFileSync } from "node:fs"

export const TYPE_START = "<!-- socket-types:start -->"
export const TYPE_END = "<!-- socket-types:end -->"

export function loadContract(url = new URL("./socket-contract.json", import.meta.url)) {
  return JSON.parse(readFileSync(url, "utf8"))
}

export function shapeOk(shape, value) {
  if (shape.includes(" | ")) return shape.split(" | ").some((part) => shapeOk(part.trim(), value))
  if (shape.startsWith('"') && shape.endsWith('"')) return value === shape.slice(1, -1)
  if (/^-?\d+$/.test(shape)) return value === Number(shape)
  if (shape === "string") return typeof value === "string"
  if (shape === "number") return typeof value === "number" && Number.isFinite(value)
  if (shape === "boolean") return typeof value === "boolean"
  if (shape === "null") return value === null
  if (shape === "array") return Array.isArray(value)
  if (shape === "object") return isObject(value)
  return false
}

export function explainMessage(messages, message) {
  if (!isObject(message) || typeof message.type !== "string") return "message needs a string type"
  const spec = messages.find((item) => item.type === message.type)
  if (!spec) return `unknown type ${message.type}`
  return explainFields(spec.fields, message, message.type)
}

export function explainLiteral(messages, literal) {
  const spec = messages.find((item) => item.type === literal.type)
  if (!spec) return `unknown type ${literal.type}`
  const keys = Object.keys(literal).filter((key) => key !== "type")
  for (const key of keys) {
    const field = spec.fields.find((item) => item.name === key)
    if (!field) return `${literal.type}.${key} is not in the contract`
    const entry = literal[key]
    if (!entry.expr && !shapeOk(field.shape, entry.value)) return `${literal.type}.${key} should be ${field.shape}`
  }
  for (const field of spec.fields) {
    if (field.required && !(field.name in literal)) return `${literal.type} needs ${field.name}`
  }
  return null
}

export function returnedCalls(source, name) {
  const at = source.indexOf(`function ${name}`)
  if (at < 0) return []
  const ret = source.indexOf("return {", at)
  if (ret < 0 || ret > at + 400) return []
  const start = source.indexOf("{", ret)
  const end = closeBrace(source, start)
  if (end < 0) return []
  const literal = parseFlat(source.slice(start, end + 1))
  return literal?.type ? [literal] : []
}

export function flatCalls(source) {
  const calls = []
  const re = /(?:send|broadcast|emit)\(\s*(?:[A-Za-z0-9_$.]+\s*,\s*)?\{/g
  for (const match of source.matchAll(re)) {
    const start = match.index + match[0].length - 1
    const end = closeBrace(source, start)
    if (end < 0) continue
    const literal = parseFlat(source.slice(start, end + 1))
    if (literal?.type) calls.push(literal)
  }
  return calls
}

export function renderTypeSection(contract) {
  return [
    TYPE_START,
    "Generated from `frontend/socket-contract.json`. Edit the JSON, then run `node scripts/generate-contract-tables.mjs`.",
    "",
    "### Page → house types",
    "",
    renderTable(contract.pageToHouse),
    "",
    `The house still accepts ${contract.houseInboundAliases.map((type) => `\`${type}\``).join(" and ")} as aliases of \`mission\` for older clients. The page must not send those aliases.`,
    "",
    "### House → page types",
    "",
    renderTable(contract.houseToPage),
    TYPE_END,
  ].join("\n")
}

export function typeSection(markdown) {
  const start = markdown.indexOf(TYPE_START)
  const end = markdown.indexOf(TYPE_END)
  if (start < 0 || end < 0 || end < start) return null
  return markdown.slice(start, end + TYPE_END.length)
}

function explainFields(fields, message, prefix) {
  for (const key of Object.keys(message)) {
    if (key === "type") continue
    const field = fields.find((item) => item.name === key)
    if (!field) return `${prefix}.${key} is not in the contract`
    if (!shapeOk(field.shape, message[key])) return `${prefix}.${key} should be ${field.shape}`
    if (field.fields && isObject(message[key])) {
      const nested = explainFields(field.fields, message[key], `${prefix}.${key}`)
      if (nested) return nested
    }
  }
  for (const field of fields) {
    if (field.required && message[field.name] === undefined) return `${prefix} needs ${field.name}`
  }
  return null
}

function renderTable(messages) {
  const lines = ["| `type` | Fields |", "| --- | --- |"]
  for (const message of messages) {
    const fields = message.fields.length === 0 ? "_(none)_" : message.fields.map(formatField).join(", ")
    lines.push(`| \`${message.type}\` | ${fields} |`)
  }
  return lines.join("\n")
}

function formatField(field) {
  const optional = field.required ? "" : ", optional"
  return `\`${field.name}\` (${field.shape}${optional})`
}

function parseFlat(source) {
  const inner = source.trim().replace(/^\{/, "").replace(/\}$/, "")
  const literal = {}
  for (const part of splitTop(inner)) {
    const splitAt = part.indexOf(":")
    if (splitAt < 0) {
      if (!/^[A-Za-z_$][\w$]*$/.test(part)) return null
      literal[part] = { expr: true, value: part }
      continue
    }
    const key = part.slice(0, splitAt).trim()
    const raw = part.slice(splitAt + 1).trim()
    if (!key || raw.includes("{")) return null
    const parsed = parseValue(raw)
    if (key === "type") {
      if (parsed.expr || typeof parsed.value !== "string") return null
      literal.type = parsed.value
      continue
    }
    literal[key] = parsed
  }
  if (typeof literal.type !== "string") return null
  return literal
}

function parseValue(raw) {
  if (raw.startsWith('"') && raw.endsWith('"')) return { expr: false, value: raw.slice(1, -1) }
  if (raw === "true") return { expr: false, value: true }
  if (raw === "false") return { expr: false, value: false }
  if (raw === "null") return { expr: false, value: null }
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { expr: false, value: Number(raw) }
  return { expr: true, value: raw }
}

function splitTop(body) {
  const parts = []
  let current = ""
  let depth = 0
  let quote = ""
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (quote) {
      current += ch
      if (ch === quote && body[i - 1] !== "\\") quote = ""
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === "(" || ch === "[") depth++
    if ((ch === ")" || ch === "]") && depth > 0) depth--
    if (ch === "," && depth === 0) {
      parts.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function closeBrace(source, start) {
  let depth = 0
  let quote = ""
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (quote) {
      if (ch === quote && source[i - 1] !== "\\") quote = ""
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === "{") depth++
    if (ch === "}") {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
