import { randomBytes } from "node:crypto"
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

export async function ensureVaultKey(dataDir: string): Promise<string> {
  if (process.env.OPERO_VAULT_KEY) return process.env.OPERO_VAULT_KEY
  await mkdir(dataDir, { recursive: true })
  const path = join(dataDir, "vault.key")
  try {
    const existing = (await readFile(path, "utf8")).trim()
    if (existing) {
      process.env.OPERO_VAULT_KEY = existing
      return existing
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  const key = randomBytes(32).toString("base64")
  await writeFile(path, key, { mode: 0o600 })
  await chmod(path, 0o600)
  process.env.OPERO_VAULT_KEY = key
  return key
}

export async function loadBrowserbaseKey(dataDir: string): Promise<string | null> {
  if (process.env.BROWSERBASE_API_KEY?.trim()) return process.env.BROWSERBASE_API_KEY.trim()
  const path = join(dataDir, "browserbase.key")
  try {
    const key = (await readFile(path, "utf8")).trim()
    if (!key) return null
    process.env.BROWSERBASE_API_KEY = key
    return key
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

export async function loadXaiKey(dataDir: string): Promise<string | null> {
  if (process.env.XAI_API_KEY?.trim()) return process.env.XAI_API_KEY.trim()
  const path = join(dataDir, "xai.key")
  try {
    const key = (await readFile(path, "utf8")).trim()
    if (!key) return null
    process.env.XAI_API_KEY = key
    return key
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

export async function saveXaiKey(dataDir: string, key: string): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  const path = join(dataDir, "xai.key")
  await writeFile(path, key, { mode: 0o600 })
  await chmod(path, 0o600)
  process.env.XAI_API_KEY = key
}

export async function verifyXaiKey(key: string): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  const response = await fetch("https://api.x.ai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (response.ok) return { ok: true }
  const body = (await response.text()).slice(0, 200)
  return { ok: false, status: response.status, detail: body || response.statusText }
}
