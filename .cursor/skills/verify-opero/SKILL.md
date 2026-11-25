---
name: verify-opero
description: Drive the Opero page at http://127.0.0.1:8788 the way a person does, and capture evidence. Use when verifying Opero chat, plan, Computer, or a spec claim. Opero is one shared in-memory house plus a page process.
---

# Verify Opero

Opero is a local web house. A person opens one page with a mission thread, a plan, and a Computer picture. The house on port 8787 is shared (WebSocket + health). The page on port 8788 is the UI. Two drivers on the same house corrupt the same mission.

## Launch

Reuse the house already listening on `127.0.0.1:8787` when `curl -fsS http://127.0.0.1:8787` returns health JSON (`{"service":"opero-home","ok":true}` or equivalent). Do not start a second house. Do not kill a process by name. The page process on 8788 is fine to restart.

If nothing is listening, from the repo root start both:

```bash
npm run dev
# or: npm run dev:fake
```

In a second terminal:

```bash
npm run dev:page
```

Ready means **both** processes are up: `curl -fsS http://127.0.0.1:8787` returns health JSON, and `curl -fsS http://127.0.0.1:8788` (or opening that URL) returns the Opero page. Doctor and drives use `http://127.0.0.1:8788`. A house that only accepts a socket without a page, or a page without a live house, is not ready. `npm run dev:fake` is the stand-in when a claim can be checked without Grok. Do not switch a live house to fake. If the setup card is waiting on a key, stop.

Teardown of a house this run started is `kill` on that process id only, after evidence is copied. A reused house stays up. A page process started for this run may be stopped or restarted freely.

## Doctor

Run this before every drive. It is read-only.

```bash
node .cursor/skills/verify-opero/bin/drive.mjs doctor
```

It passes only when the page at `http://127.0.0.1:8788` shows the Opero heading, the connection pill is `Live` or `מחובר`, and the key card is hidden (`aria-hidden="true"`). It writes `.cursor/skills/verify-opero/evidence/doctor/`. A failing doctor means do not drive.

## Drive

The harness is Playwright, already installed in this repo. It uses roles and accessible names. The house language is a setting. English controls are `Send`, `Pause agent`, `Resume agent`, `Vault`, `End`, placeholder `Give a mission…`. Hebrew controls are `שליחה`, `השהיית הסוכן`, `המשך הסוכן`, `כספת`, `סיום`, placeholder `תנו משימה…`. Read the visible name and use that exact string.

```bash
node .cursor/skills/verify-opero/bin/drive.mjs house-shell
node .cursor/skills/verify-opero/bin/drive.mjs handoff
node .cursor/skills/verify-opero/bin/drive.mjs snapshot <name>
node .cursor/skills/verify-opero/bin/drive.mjs send <name> --text "<line>" --wait-ms 20000
```

`house-shell` opens the page and records the thread, plan, and Computer without sending. `handoff` presses Pause agent, records the hint, presses Resume agent, and records the hint again. `send` types the composer by its placeholder and presses the Send button. `snapshot` records the page and the WebSocket frames the page itself sent.

The composer is the textbox whose placeholder is the mission prompt. The End field is the textbox named End or סיום. The Computer picture is the image named Computer or מחשב, present only after a screen frame. Clicks go to that image, not to coordinates chosen ahead of time.

## Evidence

Each command writes `.cursor/skills/verify-opero/evidence/<name>/` with `aria.txt` (accessibility snapshot), `page.png`, and `state.json` (badge, mission pill, hint, end, steps, thread, whether the picture is visible, and WebSocket frames). A proof is the action plus the resulting state. A screenshot alone is not a pass. Side effects the spec names (thread text, plan end, hint, trace file, picture visibility) are part of the proof. Do not call a test-only setter. Fake mode is a production `MODEL=fake` boundary, not a shortcut for a live claim.

## Cleanup

```bash
node .cursor/skills/verify-opero/bin/drive.mjs cleanup
```

Cleanup deletes `.cursor/skills/verify-opero/tmp/` only. It does not delete `evidence/`, and it does not kill the shared house.

## Helpers

`node .cursor/skills/verify-opero/bin/drive.mjs <command>` is the only helper. Commands: `doctor`, `house-shell`, `handoff`, `snapshot <name>`, `send <name> --text <line> --wait-ms <ms>`, `cleanup`.
