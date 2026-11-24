import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export function laneError(files) {
  const zones = new Set(files.map(zoneOf))
  const feature = zones.has("page") || zones.has("house")
  if (zones.has("page") && zones.has("house")) return "This diff mixes the page and the house."
  if (zones.has("contract") && feature) return "A feature diff edits the socket contract. Open a contract pull request for that file."
  return null
}

export function zoneOf(file) {
  if (
    file === "frontend/socket-contract.json" ||
    file === "frontend/CONTRACT.md" ||
    file === "frontend/contract.mjs" ||
    file.startsWith(".cursor/skills/verify-opero/")
  ) {
    return "contract"
  }
  if (file.startsWith("frontend/")) return "page"
  if (
    file.startsWith("src/") ||
    file.startsWith("test/") ||
    file === "package.json" ||
    file === "package-lock.json" ||
    file === "docs/architecture.md" ||
    file.startsWith(".github/") ||
    file.startsWith(".cursor/") ||
    file.startsWith("scripts/")
  ) {
    return "house"
  }
  return "shared"
}

function changedFiles() {
  if (process.env.LANES_BASE && process.env.LANES_HEAD) {
    return names(["diff", "--name-only", process.env.LANES_BASE, process.env.LANES_HEAD])
  }
  const files = new Set([
    ...names(["diff", "--name-only", "HEAD"]),
    ...names(["diff", "--name-only", "--cached"]),
    ...names(["ls-files", "--others", "--exclude-standard"]),
  ])
  return [...files]
}

function names(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const error = laneError(changedFiles())
  if (error) {
    console.error(error)
    process.exit(1)
  }
}
