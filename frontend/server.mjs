import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { BIND_HOST, PAGE_PORT } from "./config.mjs"

const root = path.dirname(fileURLToPath(import.meta.url))

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
}

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0])
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "")
  const resolved = path.resolve(root, relative)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null
  return resolved
}

const server = http.createServer((req, res) => {
  const filePath = safePath(req.url || "/")
  if (!filePath) {
    res.writeHead(403)
    res.end("Forbidden")
    return
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500)
      res.end(err.code === "ENOENT" ? "Not found" : "Error")
      return
    }
    const ext = path.extname(filePath)
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" })
    res.end(data)
  })
})

server.listen(PAGE_PORT, BIND_HOST, () => {
  console.log(`Opero page → http://${BIND_HOST}:${PAGE_PORT}`)
})
