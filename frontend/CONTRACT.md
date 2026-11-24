# Opero frontend ↔ house socket contract

This file is the boundary between the page package (`frontend/`) and the house process (`src/`). The page may be plain HTML today and React later. It must speak only the message types listed here. Do not invent types, rename fields, or reintroduce a `labels` push from the house.

```mermaid
flowchart LR
  person[You] --> page[Page on 8788]
  page -->|JSON socket| house[House on 8787]
  house -->|events| page
```

## Ports and how to run

| Process | Bind | Role |
| --- | --- | --- |
| House | `127.0.0.1:8787` | WebSocket for all page traffic. HTTP is health JSON only: `{ "service": "opero-home", "ok": true }`. |
| Page | `127.0.0.1:8788` | Static (or later bundler) server for the Opero UI. |

Commands from the repo root:

- House: `npm run dev` or `npm run dev:fake`
- Page: `npm run dev:page`
- Open: `http://127.0.0.1:8788`

The page opens `ws://127.0.0.1:8787` by default (configurable, for example via frontend config or a `?house=` query override). Screenshot frames travel on that same socket. The page package does not import `src/`.

## Ownership of strings

- **Page owns chrome strings** (titles, placeholders, button captions, status-pill wording, vault/key card copy). After the split those live in `frontend/labels.js`. The page applies them from `settings.language` and when the language select changes.
- **House owns server result strings** shown as message text, for example `"Saved."`, `"Removed."`, `"Not found."`, `"Key saved on this machine."`, `"Paste a Grok API key."`, `"Checking key…"`, and agent chat lines. The page displays `message` / `key_result.message` / `vault_result.message` as received.

## `labels` is removed

The house **does not** send `{ "type": "labels", ... }` on connect or on language change. The page must not wait for a `labels` event. Language preference still travels as:

- Page → house: `{ "type": "language", "language": "en" | "he" }`
- House → page: `settings.language` (and the house keeps language for the planner)

## Transport

- Framing: one JSON object per WebSocket text frame.
- No path check and no origin check on the house WebSocket (so the page on 8788 can connect).
- Field `type` is required on every message in both directions.

## Page → house

The page only sends the generated types below. `frontend/socket-contract.json` is the source for types, fields, and shapes.

<!-- socket-types:start -->
Generated from `frontend/socket-contract.json`. Edit the JSON, then run `node scripts/generate-contract-tables.mjs`.

### Page → house types

| `type` | Fields |
| --- | --- |
| `mission` | `text` (string) |
| `edit_end` | `end` (string) |
| `level` | `level` (1 | 2) |
| `language` | `language` ("en" | "he") |
| `driver` | `text` ("user" | "agent") |
| `save_key` | `key` (string) |
| `vault_list` | _(none)_ |
| `vault_save` | `description` (string), `value` (string) |
| `vault_remove` | `description` (string) |
| `click` | `x` (number), `y` (number) |
| `scroll` | `direction` ("up" | "down") |
| `press` | `key` (string) |
| `type` | `text` (string) |
| `work_status` | _(none)_ |

The house still accepts `steer` and `answer` as aliases of `mission` for older clients. The page must not send those aliases.

### House → page types

| `type` | Fields |
| --- | --- |
| `settings` | `level` (1 | 2), `language` ("en" | "he"), `workStatusPollMs` (number) |
| `ready` | `ready` (boolean), `mode` (string) |
| `key_result` | `ok` (boolean | null), `message` (string) |
| `thread` | `messages` (array) |
| `message` | `role` ("user" | "agent"), `text` (string) |
| `thinking` | `text` (string) |
| `question` | `question` (string), `reason` (string) |
| `status` | `status` ("planning" | "running" | "waiting_on_user" | "done" | "blocked" | "aborted") |
| `plan` | `mission` (object) |
| `screen` | `image` (string), `width` (number), `height` (number) |
| `driver` | `driver` ("user" | "agent") |
| `vault` | `items` (array) |
| `vault_result` | `ok` (boolean), `message` (string) |
| `work_status` | `status` (object | null) |
<!-- socket-types:end -->

On connect the house sends, in order of current practice: `settings`, `ready`, `vault`, `thread`, and `plan` when a mission exists (live or last). It does **not** send `labels`.

### Click coordinates

`click.x` and `click.y` are **image pixels**, not CSS box pixels. Map the pointer through the letterboxed picture (same math as `mapPictureClick`: scale to fit, ignore padding outside the drawn image). Clicks on letterbox padding are not sent.

## Verification DOM contract

Verification (`.cursor/skills/verify-opero`) drives accessible names and these ids. Keep them unless the verify skill is updated in the **same** change.

### Stable element ids

`title`, `subtitle`, `conn-pill`, `conn-text`, `mission-pill`, `mission-text`, `level-label`, `level`, `language-label`, `language`, `vault-open`, `chat-heading`, `ready-badge`, `thread`, `composer`, `mission`, `send`, `plan-label`, `end-label`, `end`, `steps`, `steps-empty`, `screen-heading`, `screen`, `screen-idle`, `idle-title`, `idle-text`, `take`, `hand`, `driver-hint`, `key-overlay`, `key-title`, `key-body`, `key-input`, `key-save`, `key-msg`, `vault-overlay`, `vault-title`, `vault-body`, `vault-description`, `vault-value`, `vault-save`, `vault-close`, `vault-msg`, `vault-list`, and the transient `#thinking` line inside `#thread`.

### Button accessible names (English / Hebrew)

| Control | English | Hebrew |
| --- | --- | --- |
| Send | `Send` | `שליחה` |
| Take control | `Take control` | `קחו שליטה` |
| I'm done | `I'm done` | `סיימתי` |
| Vault open | `Vault` | `כספת` |
| Vault save | `Save` | `שמירה` |
| Vault close | `Close` | `סגירה` |
| Vault remove (per row) | `Remove` | `הסרה` |
| Save key | `Save key` | `שמירת מפתח` |

Connection and ready copy used by doctor: `Live` / `מחובר`, `Offline` / `מנותק`, `Ready` / `מוכן`, and key-card title `Connect Grok` / `חיבור ל-Grok`.

## Non-negotiables

1. Do not add a message type, field, or field shape outside `frontend/socket-contract.json`. The tables in this file are generated from that JSON.
2. Do not send `labels` from the house; do not require `labels` in the page.
3. Do not move the page back onto 8787 HTTP; health JSON stays on 8787, UI on 8788.
4. Changing a listed DOM id or verification button name requires updating the verify skill in the same change.
