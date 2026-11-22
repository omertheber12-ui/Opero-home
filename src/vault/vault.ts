import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

type Entry = { description: string; valueCipher: string; iv: string; tag: string }

export function loadKey(raw: string): Buffer {
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) throw new Error("OPERO_VAULT_KEY must be 32 bytes base64")
  return key
}

export function transcript(parts: string[], secrets: string[]): string {
  return parts
    .map((part) => secrets.reduce((text, secret) => (secret ? text.split(secret).join("[secret]") : text), part))
    .join("\n")
}

function fits(field: string, saved: string): boolean {
  const left = field.trim().toLowerCase()
  const right = saved.trim().toLowerCase()
  if (!left || !right) return false
  return left.includes(right) || right.includes(left)
}

export class Vault {
  private entries: Entry[] = []

  constructor(
    private readonly filePath: string,
    private readonly key: Buffer,
  ) {}

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8")
      this.entries = JSON.parse(raw) as Entry[]
      this.entries.forEach((entry) => this.decrypt(entry))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.entries = []
        return
      }
      throw error
    }
  }

  async save(description: string, value: string): Promise<void> {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", this.key, iv)
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    this.entries.push({
      description,
      valueCipher: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
    })
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(this.entries, null, 2))
  }

  fillDetail(description: string): { status: "filled" } | { status: "missing" } {
    const matches = this.entries.filter((entry) => fits(description, entry.description))
    if (matches.length !== 1) return { status: "missing" }
    return { status: "filled" }
  }

  readValue(description: string): string | null {
    const matches = this.entries.filter((entry) => fits(description, entry.description))
    if (matches.length !== 1) return null
    return this.decrypt(matches[0]!)
  }

  values(): string[] {
    return this.entries.map((entry) => this.decrypt(entry))
  }

  private decrypt(entry: Entry): string {
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(entry.iv, "base64"))
    decipher.setAuthTag(Buffer.from(entry.tag, "base64"))
    return Buffer.concat([
      decipher.update(Buffer.from(entry.valueCipher, "base64")),
      decipher.final(),
    ]).toString("utf8")
  }
}
