# Plan block has room in the Mission column

With a live plan under a long Mission thread, Plan at the bottom of Mission keeps enough height to show End and steps. `.plan-block` uses `flex: 0 0 auto` with `max-height: 40%` and `overflow: auto`. `#thread` takes leftover space with `flex: 1 1 0`. CSS-only in `public/index.html`.

## Sub-features

- `plan-shows-content` — Plan title, End, and step texts are visible (not collapsed to a thin strip) when content is under ~40% of the Mission panel; height tracks content, not ~75px for ~260px of content.
- `fixed-window-with-plan` — document still does not scroll; `#thread` still scrolls; composer stays on screen.

## How to get to it (user POV)

- Open `http://127.0.0.1:8787`.
- Have End filled and at least one step in Plan.
- Have enough Mission history that `#thread` would compete with Plan for column height.

## Driving it with control-ui

Preconditions:

- `node .cursor/skills/verify-opero/bin/drive.mjs doctor` exits 0.
- Claims are layout-only once a plan exists; reuse the shared server on 8787.

Drive each claim from [docs/verification-claims.md](../../../../docs/verification-claims.md) under "This build — Plan block has room in the Mission column":

- **Plan section shows its content.** Open at ~1280×800. Confirm End and steps are present. Measure `.plan-block` client height vs content / scroll height and vs Mission panel height. Fail if height is a thin strip (~75px) while content needs ~260px and is under the 40% cap.
- **Fixed window still holds.** Same setup: document scroll height equals viewport; `#thread` scrolls; composer stays in view.

Proof artifacts go under `.cursor/skills/verify-opero/evidence/plan-block-room/` (aria, page.png, `layout.json`).

## Gotchas

- Without a live plan (empty End / no steps), this claim is Not checked — do not pass via an empty Plan.
- Without a tall thread, flex competition never shows; pad history or use existing long conversation.
- Do not start a second server on 8787. Do not kill by process name.
