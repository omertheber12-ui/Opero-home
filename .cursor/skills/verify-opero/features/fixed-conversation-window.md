# Fixed conversation window

The house stays one viewport tall. A long Mission history scrolls inside `#thread`. The app bar, composer, and Computer stay on screen. CSS-only in `public/index.html`.

## Sub-features

- `page-one-screen` — body and shell stay viewport-bounded; the document does not grow or scroll when the thread is taller than the panel.
- `thread-scrolls` — history scrolls inside Mission `#thread`; latest line is reachable; composer and app bar stay in place.
- `computer-visible-wide` — Computer panel (picture or idle) and Take control / I'm done stay visible beside chat on a wide window.
- `narrow-stacked` — at width ≤960px the same rules hold with the stacked desk.

## How to get to it (user POV)

- Open `http://127.0.0.1:8787`.
- Have enough Mission lines that `#thread` content is taller than the panel (existing conversation history is enough when the store already has many turns).
- For narrow: resize the window to ≤960px wide.

## Driving it with control-ui

Preconditions:

- `node .cursor/skills/verify-opero/bin/drive.mjs doctor` exits 0.
- Claims are layout-only; `npm run dev` or an already-running Opero on 8787 is fine. Fake mode is acceptable.

Drive each claim from [docs/verification-claims.md](../../../../docs/verification-claims.md) under "This build — fixed conversation window":

- **Page stays one screen tall.** Open at ~1280×800. Confirm thread overflows. Measure: document scroll height equals viewport; `body`/`html` overflow does not create a page scroll.
- **History scrolls inside Mission.** Scroll `#thread` to the end. Latest line is visible. Composer and app bar bounding boxes stay in the viewport.
- **Computer stays visible.** Beside the chat, Computer heading, screen frame (img or idle), Take control, and I'm done are in the viewport.
- **Narrow layout.** Set viewport width ≤960. Repeat: no document scroll; `#thread` scrolls; Computer controls remain in the window.

Proof artifacts go under `.cursor/skills/verify-opero/evidence/fixed-layout-wide/` and `fixed-layout-narrow/` (aria, page.png, and a `layout.json` of measured scroll/visibility).

## Gotchas

- Without enough thread lines, overflow never engages — pad by ensuring history is tall, not by weakening the claim.
- The Computer *picture* (`#screen`) appears only after a screen frame; the idle Computer panel still counts as the Computer surface for visibility when no frame has arrived.
- Button names follow the house language (Take control / I'm done or קחו שליטה / סיימתי).
- Do not start a second server on 8787. Do not kill by process name.
