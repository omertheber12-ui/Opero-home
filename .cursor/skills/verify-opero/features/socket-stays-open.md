# Socket stays open

A person can open Opero, and a bad socket frame or an unknown message type does not take the house down. The page still loads.

## Sub-features

- `page-loads` shows Opero, a Live connection, and the mission composer.
- `bad-frame` keeps the socket and the house up after a frame that is not JSON, and the page stays Live.
- `unknown-type` keeps the socket and the house up after a message type the house does not know, and the page stays Live.

## How to get to it (user POV)

- Open `http://127.0.0.1:8788`.
- Wait until the connection pill says Live or מחובר.
- The bad frame and the unknown type are sent on a socket to the same house the page is using. There is no button for them.

## Driving it with control-ui

Preconditions:

- `node .cursor/skills/verify-opero/bin/drive.mjs doctor` exits 0.
- The house under test is this working tree. A house from another checkout on 8787 is not this claim.

- **Open the page.** Run `node .cursor/skills/verify-opero/bin/drive.mjs house-shell`. The heading Opero is visible. The connection pill says Live or מחובר. The composer and Send are visible. The setup card is hidden.
- **Send a bad frame.** With the page still open and Live, open a socket to that house and send the text `not-json`. Wait briefly. The sending socket stays open. Curl the house health URL and require `{ "service": "opero-home", "ok": true }`. The page connection is still Live or מחובר. Reload the page. Opero and Live show again.
- **Send an unknown type.** With the page Live, send `{"type":"not-a-real-type"}` on a socket to that house. The sending socket stays open. Health is still ok. The page stays Live. Reload shows Opero and Live again.
- **Proof.** `evidence/socket-stays-open/` records the action (the frame that was sent) and the resulting state (socket open, health ok, connection Live, page loaded again). A screenshot alone is not the proof.

## Gotchas

- Doctor fails when the setup card is waiting on a key. Stop. Do not type a key.
- Port 8787 may already be a different checkout. Do not treat that process as this working tree. Do not kill it by name. Start this tree's house only when 8787 is not already this house, and point the page at it.
- Two drives on one house share one mission. This claim does not send a mission.
