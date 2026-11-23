import { randomBytes } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { Vault, loadKey, transcript } from "../src/vault/vault.js"

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("vault", () => {
  it("fills one matching detail and hides the value", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-vault-"))
    dirs.push(dir)
    const key = loadKey(randomBytes(32).toString("base64"))
    const vault = new Vault(join(dir, "vault.json"), key)
    await vault.save("card number", "4242")
    const result = vault.fillDetail("Card number")
    expect(result).toEqual({ status: "filled" })
    expect(JSON.stringify(result)).not.toContain("4242")
    expect(transcript(["page", "4242"], ["4242"])).toBe("page\n[secret]")
  })

  it("refuses when two entries fit the same description", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-vault-"))
    dirs.push(dir)
    const key = loadKey(randomBytes(32).toString("base64"))
    const vault = new Vault(join(dir, "vault.json"), key)
    await vault.save("card number", "4242")
    await vault.save("visa card number", "9999")
    expect(vault.fillDetail("Card number")).toEqual({ status: "missing" })
  })

  it("throws when the key is wrong", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-vault-"))
    dirs.push(dir)
    const file = join(dir, "vault.json")
    const vault = new Vault(file, loadKey(randomBytes(32).toString("base64")))
    await vault.save("card number", "4242")
    const other = new Vault(file, loadKey(randomBytes(32).toString("base64")))
    await expect(other.load()).rejects.toThrow()
  })

  it("lists descriptions without values and removes by description", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opero-vault-"))
    dirs.push(dir)
    const vault = new Vault(join(dir, "vault.json"), loadKey(randomBytes(32).toString("base64")))
    await vault.save("CNBC password", "secret-value")
    const listed = vault.descriptions()
    expect(listed).toEqual(["CNBC password"])
    expect(JSON.stringify(listed)).not.toContain("secret-value")
    expect(await vault.remove("CNBC password")).toBe(true)
    expect(vault.descriptions()).toEqual([])
  })
})

