#!/usr/bin/env node
import { mkdir, writeFile, rm, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const evidenceRoot = join(root, "evidence")
const tmpRoot = join(root, "tmp")
const pageUrl = process.env.OPERO_URL ?? "http://127.0.0.1:8788"

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  return process.argv[index + 1] ?? fallback
}

async function save(name, page, extra) {
  const dir = join(evidenceRoot, name)
  await mkdir(dir, { recursive: true })
  const aria = await page.locator("body").ariaSnapshot()
  await writeFile(join(dir, "aria.txt"), aria)
  await page.screenshot({ path: join(dir, "page.png"), fullPage: true })
  const snap = await readState(page)
  const body = { ...snap, ...extra }
  await writeFile(join(dir, "state.json"), JSON.stringify(body, null, 2))
  return body
}

async function readState(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector("#key-overlay")
    const screen = document.querySelector("#screen")
    const steps = document.querySelector("#steps")
    return {
      title: document.querySelector("#title")?.textContent ?? "",
      conn: document.querySelector("#conn-text")?.textContent ?? "",
      badge: document.querySelector("#ready-badge")?.textContent ?? "",
      mission: document.querySelector("#mission-text")?.textContent ?? "",
      hint: document.querySelector("#driver-hint")?.textContent ?? "",
      end: document.querySelector("#end")?.value ?? "",
      steps: steps?.innerText ?? "",
      idle: document.querySelector("#idle-text")?.textContent ?? "",
      idleHidden: document.querySelector("#screen-idle")?.classList.contains("hidden") ?? false,
      screenHidden: Boolean(screen?.hidden),
      screenAlt: screen?.getAttribute("alt") ?? "",
      keyHidden: overlay?.getAttribute("aria-hidden") ?? "",
      thread: document.querySelector("#thread")?.innerText ?? "",
      thinking: document.querySelector("#thinking")?.textContent ?? null,
      placeholder: document.querySelector("#mission")?.getAttribute("placeholder") ?? "",
      send: document.querySelector("#send")?.textContent ?? "",
      take: document.querySelector("#take")?.textContent ?? "",
      hand: document.querySelector("#hand")?.textContent ?? "",
    }
  })
}

async function openPage() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const sent = []
  const received = []
  page.on("websocket", (ws) => {
    ws.on("framesent", (frame) => sent.push(String(frame.payload)))
    ws.on("framereceived", (frame) => {
      const text = String(frame.payload)
      if (text.includes('"type":"screen"')) {
        received.push('{"type":"screen"}')
        return
      }
      received.push(text.length > 1500 ? `${text.slice(0, 1500)}…` : text)
    })
  })
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" })
  await page.getByRole("heading", { name: "Opero", level: 1 }).waitFor({ timeout: 10000 })
  await page.waitForFunction(() => {
    const text = document.querySelector("#conn-text")?.textContent ?? ""
    return text === "Live" || text === "מחובר"
  }, null, { timeout: 10000 })
  return { browser, page, sent, received }
}

function doctorProblems(snap) {
  const problems = []
  if (snap.title !== "Opero") problems.push("heading is not Opero")
  if (snap.conn !== "Live" && snap.conn !== "מחובר") problems.push(`connection is ${snap.conn || "blank"}`)
  if (snap.keyHidden !== "true") problems.push("setup card is waiting on a key")
  if (snap.badge !== "Ready" && snap.badge !== "מוכן") problems.push(`badge is ${snap.badge || "blank"}`)
  return problems
}

async function doctor() {
  const session = await openPage()
  try {
    await session.page.waitForTimeout(500)
    const snap = await save("doctor", session.page, {
      sent: session.sent,
      receivedTypes: session.received.map((frame) => {
        try { return JSON.parse(frame).type } catch { return "unparsed" }
      }),
    })
    const problems = doctorProblems(snap)
    console.log(JSON.stringify({ ok: problems.length === 0, problems, badge: snap.badge, mission: snap.mission, hint: snap.hint, screenHidden: snap.screenHidden }, null, 2))
    process.exitCode = problems.length === 0 ? 0 : 2
  } finally {
    await session.browser.close()
  }
}

async function houseShell() {
  const session = await openPage()
  try {
    await session.page.getByRole("heading", { name: "Mission", level: 2 }).waitFor()
    const take = session.page.getByRole("button", { name: /Take control|קחו שליטה/ })
    const hand = session.page.getByRole("button", { name: /I'm done|סיימתי/ })
    const send = session.page.getByRole("button", { name: /Send|שליחה/ })
    await take.waitFor()
    await hand.waitFor()
    await send.waitFor()
    const snap = await save("house-shell", session.page, { sent: session.sent })
    const problems = doctorProblems(snap)
    if (!snap.placeholder) problems.push("composer has no placeholder")
    console.log(JSON.stringify({ ok: problems.length === 0, problems, placeholder: snap.placeholder, send: snap.send, take: snap.take, mission: snap.mission, screenHidden: snap.screenHidden, idle: snap.idle }, null, 2))
    process.exitCode = problems.length === 0 ? 0 : 2
  } finally {
    await session.browser.close()
  }
}

async function handoff() {
  const session = await openPage()
  try {
    const before = await save("handoff-before", session.page, {})
    const takeName = before.take
    const handName = before.hand
    await session.page.getByRole("button", { name: takeName, exact: true }).click()
    await session.page.waitForFunction((expected) => {
      const hint = document.querySelector("#driver-hint")?.textContent ?? ""
      return hint.length > 0 && hint !== expected
    }, before.hint, { timeout: 5000 }).catch(() => undefined)
    const driving = await save("handoff-driving", session.page, { sent: [...session.sent] })
    await session.page.getByRole("button", { name: handName, exact: true }).click()
    await session.page.waitForTimeout(400)
    const returned = await save("handoff-returned", session.page, { sent: [...session.sent] })
    console.log(JSON.stringify({
      before: before.hint,
      driving: driving.hint,
      returned: returned.hint,
      screenHidden: returned.screenHidden,
      sent: session.sent,
    }, null, 2))
  } finally {
    await session.browser.close()
  }
}

async function snapshot(name) {
  const session = await openPage()
  try {
    const waitMs = Number(arg("--wait-ms", "1500"))
    await session.page.waitForTimeout(waitMs)
    const snap = await save(name, session.page, { sent: session.sent, received: session.received })
    console.log(JSON.stringify({
      name,
      mission: snap.mission,
      hint: snap.hint,
      screenHidden: snap.screenHidden,
      idleHidden: snap.idleHidden,
      thinking: snap.thinking,
      thread: snap.thread,
      end: snap.end,
      steps: snap.steps,
      sent: session.sent,
    }, null, 2))
  } finally {
    await session.browser.close()
  }
}

async function send(name) {
  const text = arg("--text")
  if (!text) throw new Error("send requires --text")
  const waitMs = Number(arg("--wait-ms", "20000"))
  const session = await openPage()
  try {
    const before = await readState(session.page)
    const box = session.page.getByPlaceholder(before.placeholder)
    await box.fill(text)
    await session.page.getByRole("button", { name: before.send, exact: true }).click()
    const started = Date.now()
    while (Date.now() - started < waitMs) {
      await session.page.waitForTimeout(500)
    }
    const snap = await save(name, session.page, {
      typed: text,
      sent: session.sent,
      received: session.received.filter((frame) => !frame.includes('"type":"labels"')),
      beforeMission: before.mission,
      beforeEnd: before.end,
      beforeSteps: before.steps,
    })
    console.log(JSON.stringify({
      name,
      sent: session.sent,
      beforeMission: before.mission,
      mission: snap.mission,
      hint: snap.hint,
      thinking: snap.thinking,
      thread: snap.thread,
      end: snap.end,
      stepsChanged: snap.steps !== before.steps,
      screenHidden: snap.screenHidden,
    }, null, 2))
  } finally {
    await session.browser.close()
  }
}

async function cleanup() {
  await rm(tmpRoot, { recursive: true, force: true })
  const marker = join(evidenceRoot, "house-shell", "state.json")
  const still = await readFile(marker, "utf8").then(() => true).catch(() => false)
  console.log(JSON.stringify({ removed: tmpRoot, evidenceRemains: still }))
  process.exitCode = still ? 0 : 2
}

const command = process.argv[2]
const commands = { doctor, "house-shell": houseShell, handoff, snapshot, send, cleanup }
const run = commands[command]
if (!run) {
  console.error("usage: drive.mjs doctor|house-shell|handoff|snapshot <name>|send <name> --text <line>|cleanup")
  process.exit(1)
}
if (command === "snapshot" || command === "send") {
  await run(process.argv[3])
} else {
  await run()
}
