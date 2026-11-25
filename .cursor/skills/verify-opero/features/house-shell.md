# House shell

The house page is one chat, one plan, and one Computer. A person can see all three before sending a mission.

## Sub-features

- `shell-open` shows Opero, the mission composer, the plan, and the Computer.
- `shell-ready` hides the Connect Grok card when a key is already saved.

## How to get to it (user POV)

- Open `http://127.0.0.1:8788`.

## Driving it with control-ui

Preconditions:

- `node .cursor/skills/verify-opero/bin/drive.mjs doctor` exits 0.

- **Open the house.** Go to the page. Run `node .cursor/skills/verify-opero/bin/drive.mjs house-shell`. The heading Opero is visible, the connection pill says Live or מחובר, and the badge says Ready or מוכן.
- **See the composer.** The mission textbox shows placeholder Give a mission… or תנו משימה…. The Send button is named Send or שליחה.
- **See the plan.** The End textbox is named End or סיום. Empty steps say that steps appear after a mission, or the current mission's steps are listed.
- **See the Computer.** The computer card heading is Agent’s computer or המחשב של הסוכן. Watch full screen opens the full-screen view, where Pause agent is a button and Resume agent appears while paused. The idle line is visible when no picture has arrived.
- **Proof.** `evidence/house-shell/aria.txt` names those controls, and `state.json` records the badge, mission pill, and whether the picture is hidden.

## Gotchas

- Button names follow the house language. An English-only name misses a Hebrew house.
- The key card uses aria-hidden. A visible card means stop. Do not type a key.
- This server is shared. Opening the page does not clear a mission that is already waiting.
