# Completion and safety

A payment finishes only with a confirmation token. Consequential controls ask first. A restart does not repeat the last action. Rescue reviews an ordinary failure before the person is asked. The trace separates a site failure from a reasoning failure.

## Sub-features

- `payment-proof` does not finish a pay, buy, order, book, delete, send, subscribe, or transfer from the expected sentence alone.
- `pay-asks` asks before Pay, Submit, Sign in, and the other consequential controls.
- `yes-once` lets one clear yes run that action once, and repeats the question for any other reply.
- `paused-step` asks and does not navigate or click while the current step is paused.
- `wrong-account` asks and does not sign out when the page shows a different email.
- `restart` keeps the mission, says Opero restarted, and does not repeat the last action.
- `stall-review` calls the planner after three ineffective actions and keeps the end.
- `rescue` reviews a failed open, a site error, a stall, or a used-up budget before asking. This build: a thinking line appears before the rescue question. The trace line is marked `site` or `reasoning`. A secret in the trace is `[secret]`. A bot check does not use that path.
- `same-moment` keeps a thin page on that screenshot and skips a control that is no longer there.
- `quiet-house` closes the browser after ten quiet minutes and wakes the same browser on a later message.
- `trace-class` marks a failed mission's trace as site or reasoning, with secrets shown as "[secret]".
- `task-list` is the checklist a person runs: public read tasks and one controlled checkout.

## How to get to it (user POV)

- Send a pay or order mission and land on a page that only contains the expected sentence.
- Reach a Pay or Sign in control, then answer the submit question.
- Start a mission whose current step is paused, or whose page shows a different email.
- Restart Opero after a running mission.
- Let a mission stall, fail to open, or run out of budget.
- Leave the page idle for ten minutes, then Send.
- Open `data/traces/<missionId>.jsonl`.
- Open `docs/eval/browser-tasks.md` and run one public read task and the controlled checkout in the chat.

## Driving it with control-ui

Preconditions:

- Doctor passes.
- The Computer can open the page the journey names. If the computer cannot wake, say so and do not substitute a different page.
- Do not answer yes to a real payment, booking, or delete.

- **Payment wording.** Land on the expected sentence without a confirmation number. The mission badge does not become Done. The thread asks. Pay is not clicked again.
- **Approval.** When the thread asks "This step submits, deletes, sends, or changes an account. Should I continue?", a clear yes runs that control once. A vague reply asks again. An unknown submit is not clicked again.
- **Pause and account.** A paused step does not open the site. A different email produces the open-account warning and the page stays signed in.
- **Restart.** Restart the app this run started. The plan remains. The thread says Opero restarted and will not repeat the last action. A failed wake is not Done.
- **Rescue and stall.** The first failed open does not immediately ask "tell me how to continue". After the budget is used, the question follows the review. A bot check still hands over the browser without that review question first.
- **Quiet house.** Leave the page idle for ten minutes. The Computer returns to the idle screen. The next Send brings the picture back.
- **Trace.** Open the mission file under `data/traces`. The failure line is marked site or reasoning. A typed secret is "[secret]".
- **Checklist.** Open the browser task checklist. Run one public read task and the controlled checkout in the chat.
- **Proof.** Thread text, badge, End field, and the trace file. A screenshot of the idle Computer is not the ten-minute proof unless the idle stretch was actually waited.

## Gotchas

- Restarting the shared server kills the house the person is using. If this run did not start the server, the restart journey is not run.
- Approving a real Pay click is not a verification step.
- The checklist file existing is not the live read task. The read task is a mission in the chat.
