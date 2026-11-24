# Frontend split

The house page lives in the `frontend/` package on port 8788. The house process on 8787 is health + WebSocket only. Chrome strings come from the page (`frontend/labels.js`), not a `labels` socket event.

## Sub-features

- `two-processes-ready` — house health on 8787 and page UI on 8788.
- `house-shell-on-8788` — Opero heading, Live/מחובר, hidden key card, composer, Send, Take control, I'm done, Vault.
- `socket-across-origins` — page on 8788 talks to house WebSocket on 8787; fake mission yields thread activity and a plan end.
- `local-labels` — Language → Hebrew updates button names from page labels without a house `labels` push.
- `contract-exists` — `frontend/CONTRACT.md` documents the socket boundary; house no longer serves `public/index.html`.

## How to get to it (user POV)

- From repo root: house with `npm run dev:fake` (or reuse 8787), page with `npm run dev:page` (or reuse 8788).
- Open `http://127.0.0.1:8788`.

## Driving it with control-ui

Preconditions:

- `curl -fsS http://127.0.0.1:8787/health` (or `/`) returns `{"service":"opero-home","ok":true}`.
- Page responds on `http://127.0.0.1:8788`.
- `node .cursor/skills/verify-opero/bin/drive.mjs doctor` exits 0.

- **Two processes.** Confirm health JSON on 8787 and HTTP 200 for the page on 8788. Doctor and drives use 8788 only.
- **House shell.** Run `node .cursor/skills/verify-opero/bin/drive.mjs house-shell`. Heading Opero, connection Live or מחובר, key card `aria-hidden=true`, placeholder Give a mission…, Send / Take control / I'm done / Vault present.
- **Socket mission.** Run `node .cursor/skills/verify-opero/bin/drive.mjs send split-mission --text "Open example.com and bring back the title" --wait-ms 25000`. Proof: WebSocket frames go to 8787; thread gains activity; End is filled (fake planner plan ready).
- **Local labels.** On the page, set Language to Hebrew. Confirm Send→שליחה, Take control→קחו שליטה, I'm done→סיימתי, Vault→כספת. WebSocket received frames must not include `type: labels`.
- **Contract.** `frontend/CONTRACT.md` exists and documents ports/socket. `public/index.html` is absent (house does not serve the page).

## Gotchas

- Doctor drives 8788, not 8787. A healthy house alone is not ready.
- Do not start a second house on 8787.
- Fake mode is enough for shell, socket plan-ready, and labels claims. Do not switch a live house to fake mid-run.
- A claim the map dropped is still driven and listed as unmapped.
