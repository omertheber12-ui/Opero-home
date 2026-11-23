import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { House, Language, Level, Mission } from "../domain/types.js"

type Saved = { house: House; mission: Mission | null }

export async function openHouse(dataDir: string): Promise<Saved> {
  await mkdir(dataDir, { recursive: true })
  const file = join(dataDir, "house.json")
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Saved
    if (parsed?.house?.id) return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error
  }
  const house: House = {
    id: "house_builder",
    language: "en",
    level: 2,
    profileDir: join(dataDir, "profile"),
    vaultPath: join(dataDir, "vault.json"),
  }
  const saved = { house, mission: null }
  await writeFile(file, JSON.stringify(saved, null, 2))
  return saved
}

export async function saveHouse(dataDir: string, house: House, mission: Mission | null): Promise<void> {
  await writeFile(join(dataDir, "house.json"), JSON.stringify({ house, mission }, null, 2))
}

export function withSettings(house: House, level: Level, language: Language): House {
  return { ...house, level, language }
}
