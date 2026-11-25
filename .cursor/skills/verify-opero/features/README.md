# Opero verification map

This directory is the maintained source for verifying Opero. Read the index, then use the matching feature file. Claims that a file does not name are still driven and reported as unmapped.

## Baseline preconditions

- Opero house is already on `http://127.0.0.1:8787` (health + WebSocket) and the page on `http://127.0.0.1:8788`, or this run started both with `npm run dev` and `npm run dev:page` from the repo.
- Run `node .cursor/skills/verify-opero/bin/drive.mjs doctor` and require a hidden key card, connection `Live` or `מחובר`, and badge `Ready` or `מוכן`. Doctor drives 8788.
- Do not start a second house. Do not kill a process by name. The page process is fine to restart.
- The house language may be English or Hebrew. Use the visible button name.
- Prefer `npm run dev:fake` only when a claim does not need a live planner choice. Claims that abort for a new mission need a live planner that can return `start`.

## Driving conventions

- Prefer ARIA roles and accessible names over coordinates.
- The composer is the textbox with the mission placeholder. Send is the button named Send or שליחה.
- Capture the action and the next state under `.cursor/skills/verify-opero/evidence/`.
- A missing precondition is recorded on that feature. Do not swap in a different path and call it the same claim.

## This build — Split the house page into `frontend/` package

Drive the claims in [docs/verification-claims.md](../../../../docs/verification-claims.md) under "This build — Split the house page into `frontend/` package". Fake house OK. Reuse 8787 + 8788 when healthy. Doctor and drives use 8788.

- [Frontend split](./frontend-split.md) — two processes, shell on 8788, socket across origins, local labels (no house `labels` event), CONTRACT.md and no `public/index.html`.

## Prior build — Plan block has room in the Mission column

Drive the claims in [docs/verification-claims.md](../../../../docs/verification-claims.md) under "Prior build — Plan block has room in the Mission column". Layout-only once End + steps exist; reuse the shared house on 8787 and page on 8788. Fake or live is fine.

- [Plan block room](./plan-block-room.md) — Plan height tracks content under the 40% cap; fixed window (no document scroll, `#thread` scrolls, composer visible) still holds.

## Prior build — fixed conversation window

Drive the claims in [docs/verification-claims.md](../../../../docs/verification-claims.md) under "This build — fixed conversation window". Layout-only; reuse the shared house on 8787 and page on 8788. Fake or live is fine.

- [Fixed conversation window](./fixed-conversation-window.md) — page one screen tall, Mission `#thread` scrolls, Computer stays visible wide and at ≤960px.

## Prior build — clarifying questions in the conversation file

Drive the claims in [docs/verification-claims.md](../../../../docs/verification-claims.md) under "This build — clarifying questions in the conversation file". Live planner required (`npm run dev`, not fake).

- [Live conversation](./live-conversation.md) — `clarify-in-conversation-file` and `clarify-keeps-earlier-answers`, plus older chat-owns-missions journeys.

## Prior build — chat owns missions

Drive the claims in [docs/superpowers/specs/2026-11-23-chat-owns-missions.md](../../../../docs/superpowers/specs/2026-11-23-chat-owns-missions.md) and the matching sections in [docs/verification-claims.md](../../../../docs/verification-claims.md): "A different mission starts now", "The planner can answer, guide, replan, resume, stop, or start", "A newer mission takes priority", and thread replay. Older map entries stay and are not a pass when they were not driven.

- [Live conversation](./live-conversation.md) — status without abort, abort-for-new, newer mission priority, planner choices, and thread replay from `data/conversation.json`.
- [Challenge and status](./challenge-and-status.md) — readable progress and the page's own `work_status` poll while Running.
- [Completion and safety](./completion-and-safety.md) — rescue thinking line, trace class, and `[secret]`.

## Features

- [Frontend split](./frontend-split.md) is the page package on 8788 talking to the house on 8787.
- [Plan block room](./plan-block-room.md) keeps Plan tall enough under a long Mission thread.
- [House shell](./house-shell.md) opens the chat, plan, and Computer.
- [Computer takeover](./computer-takeover.md) covers Pause agent, picture input, and Resume agent.
- [Challenge and status](./challenge-and-status.md) covers a bot-check handoff, the thinking line, work status, and readable progress.
- [Completion and safety](./completion-and-safety.md) covers payment proof, approval, pause, account, restart, rescue, and trace.
- [Live conversation](./live-conversation.md) covers a chat line during a mission, new-mission priority, one action agent, and wake when a plan exists.
