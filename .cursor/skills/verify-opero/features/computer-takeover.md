# Computer takeover

Take control stops Opero and lets the person click, type, and scroll the Computer picture. I'm done hands the same page back.

## Sub-features

- `take-stop` stops the agent and shows that the person is driving.
- `picture-input` sends a click, a key, and the wheel to that picture, and ignores the padding.
- `hand-back` shows that Opero is driving again and the next step starts from the page the person left.

## How to get to it (user POV)

- While a mission shows the Computer picture, press Take control.
- Click a link on the picture, type in a field, and scroll.
- Click the empty margin around the picture.
- Press I'm done.

## Driving it with control-ui

Preconditions:

- Doctor passes.
- The Computer image is visible (`screenHidden` is false in a snapshot). A hidden picture means this journey cannot be finished.

- **Take control.** Press the button named Take control or קחו שליטה. Run `node .cursor/skills/verify-opero/bin/drive.mjs handoff` for the hint cycle. The hint says the person is driving.
- **Use the picture.** Click the image named Computer or מחשב, type a character, and scroll the wheel while the hint says the person is driving. The picture changes from those inputs. A click on the frame padding does not move the page.
- **Hand back.** Press I'm done or סיימתי. The hint says Opero is driving. The following agent step starts from the page just left.
- **Proof.** `evidence/handoff-driving/state.json` and `evidence/handoff-returned/state.json` record the hint before and after. Picture proof needs a later snapshot whose image differs after the click.

## Gotchas

- Without a visible picture, the click, key, wheel, and margin checks are not reachable. Do not treat the hint change as those checks.
- Take control on an idle Computer still changes the hint. That does not prove a click reached the browser.
- I'm done resumes the agent. Do not hand back during a real payment or booking.
