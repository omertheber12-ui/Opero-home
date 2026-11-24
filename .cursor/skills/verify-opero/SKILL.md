---
name: verify-opero
description: Drive the Opero house page at http://127.0.0.1:8787 the way a person does, and capture evidence. Use when verifying Opero chat, plan, Computer, or a spec claim. Opero is one shared in-memory server.
---

# Verify Opero

Opero is a local web house. A person opens one page with a mission thread, a plan, and a Computer picture. The server on port 8787 is shared. Two drivers corrupt the same mission.

## Launch

Reuse the server that is already listening on `127.0.0.1:8787` when `curl -fsS http://127.0.0.1:8787` returns the Opero page. Do not start a second copy. Do not kill a process by name.

If nothing is listening, from the repo root:

```bash
npm run dev
```

Ready means the process prints `Opero Home → http://127.0.0.1:8787` and the page is usable: the heading Opero is visible, the connection pill says `Live` or `מחובר`, and the Connect Grok card is hidden. A process that only accepts a socket is not ready. `npm run dev:fake` is the stand-in when a claim can be checked without Grok. Do not switch a live server to fake. If the setup card is waiting on a key, stop.

Teardown of a server this run started is `kill` on that process id only, after evidence is copied. A reused server stays up.

## Doctor

Run this before every drive. It is read-only.

```bash
node .cursor/skills/verify-opero/bin/drive.mjs doctor
```

It passes only when the page at `http://127.0.0.1:8787` shows the Opero heading, the connection pill is `Live` or `מחובר`, and the key card is hidden (`aria-hidden="true"`). It writes `.cursor/skills/verify-opero/evidence/doctor/`. A failing doctor means do not drive.

## Drive

The harness is Playwright, already installed in this repo. It uses roles and accessible names. The house language is a setting. English controls are `Send`, `Take control`, `I'm done`, `Vault`, `End`, placeholder `Give a mission…`. Hebrew controls are `שליחה`, `קחו שליטה`, `סיימתי`, `כספת`, `סיום`, placeholder `תנו משימה…`. Read the visible name and use that exact string.

```bash
node .cursor/skills/verify-opero/bin/drive.mjs house-shell
node .cursor/skills/verify-opero/bin/drive.mjs handoff
node .cursor/skills/verify-opero/bin/drive.mjs snapshot <name>
node .cursor/skills/verify-opero/bin/drive.mjs send <name> --text "<line>" --wait-ms 20000
```

`house-shell` opens the page and records the thread, plan, and Computer without sending. `handoff` presses Take control, records the hint, presses I'm done, and records the hint again. `send` types the composer by its placeholder and presses the Send button. `snapshot` records the page and the WebSocket frames the page itself sent.

The composer is the textbox whose placeholder is the mission prompt. The End field is the textbox named End or סיום. The Computer picture is the image named Computer or מחשב, present only after a screen frame. Clicks go to that image, not to coordinates chosen ahead of time.

## Evidence

Each command writes `.cursor/skills/verify-opero/evidence/<name>/` with `aria.txt` (accessibility snapshot), `page.png`, and `state.json` (badge, mission pill, hint, end, steps, thread, whether the picture is visible, and WebSocket frames). A proof is the action plus the resulting state. A screenshot alone is not a pass. Side effects the spec names (thread text, plan end, hint, trace file, picture visibility) are part of the proof. Do not call a test-only setter. Fake mode is a production `MODEL=fake` boundary, not a shortcut for a live claim.

## Cleanup

```bash
node .cursor/skills/verify-opero/bin/drive.mjs cleanup
```

Cleanup deletes `.cursor/skills/verify-opero/tmp/` only. It does not delete `evidence/`, and it does not kill the shared server.

## Helpers

`node .cursor/skills/verify-opero/bin/drive.mjs <command>` is the only helper. Commands: `doctor`, `house-shell`, `handoff`, `snapshot <name>`, `send <name> --text <line> --wait-ms <ms>`, `cleanup`.
