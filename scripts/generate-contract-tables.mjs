import { readFileSync, writeFileSync } from "node:fs"
import { loadContract, renderTypeSection, TYPE_END, TYPE_START } from "../frontend/contract.mjs"

const path = new URL("../frontend/CONTRACT.md", import.meta.url)
const markdown = readFileSync(path, "utf8")
const start = markdown.indexOf(TYPE_START)
const end = markdown.indexOf(TYPE_END)
if (start < 0 || end < 0) {
  console.error("CONTRACT.md is missing the socket-types markers")
  process.exit(1)
}
const next = markdown.slice(0, start) + renderTypeSection(loadContract()) + markdown.slice(end + TYPE_END.length)
writeFileSync(path, next)
