# Challenge and status

Claim under this run: "Bot check is tried, then handed over" in `docs/verification-claims.md`. On a Cloudflare or Turnstile check, a Google sorry page, or a page that says "Performing security verification", Opero tries the check itself. The chat says it is trying. If the check is still there after those tries, the chat tells the person to finish it and includes the Browserbase live-view URL when one exists. If the check clears, Opero keeps the mission and does not hand over the browser. A page that only says "just a moment" stays with Opero and does not post the handoff.

## Sub-features

- `bot-check` tries Cloudflare, Turnstile, a Google sorry page, or "Performing security verification" before posting the live-view URL. The thread shows a trying line, then a click, before any live-view handoff. The URL is posted only when the check is still there after those tries.
- `check-clears` keeps the mission with Opero when that check goes away. The thread does not post the handoff.
- `just-a-moment` leaves a page that only says "just a moment" with Opero. The thread does not post the handoff.
- `thinking-line` shows one muted narration line and removes it on the next message or question.
- `work-status` returns a snapshot of mission, phase, step, last action, and challenge while the Computer keeps moving. This build: while Running, the page itself polls `work_status`. A snapshot comes back. The worker does not wait on that read. The action agent also posts a readable progress line.

## How to get to it (user POV)

- Send a mission that opens a bot-check page. For the negative case, open a page whose only challenge text is "just a moment".
- Watch the Mission thread during a turn.
- While a mission is running, the connected page asks for work status.

## Driving it with control-ui

Preconditions:

- Doctor passes.
- A mission can be sent without answering a question that is already waiting. If the badge is Waiting, sending is not a fresh mission.
- The Computer can wake. A wake failure blocks the bot-check page.

- **Bot check.** Send a mission that opens one of those pages. The thread shows a trying line and the agent clicks before any live-view handoff. The handoff, with its URL when one exists, appears only if the check is still there. The Computer then stays with the person until I'm done.
- **Check clears.** Open a page that starts on that check and leaves it after the click. Opero keeps the mission. The thread does not post the handoff.
- **Just a moment.** Open a page whose only challenge text is "just a moment". Opero keeps driving and the thread does not post the handoff.
- **Thinking.** Send a mission and watch the thread. One thinking line appears during the turn and is gone after the next message or question.
- **Work status.** During a running mission, record the frames the page sends. The page sends `{"type":"work_status"}` on its own while the pill says Running. A `work_status` snapshot comes back in the same stretch as later `screen` frames. The thread shows a short progress line from the action agent.
- **Proof.** The evidence `state.json` includes the thread text, the thinking line, and the frames the page sent.

## Gotchas

- Network routing is not part of this feature.
- A lone "just a moment" must not be reported as a bot-check pass.
- The page has no Work status button. The proof is a frame the connected page sends on its own. Injecting that frame from outside the page is a different path.
