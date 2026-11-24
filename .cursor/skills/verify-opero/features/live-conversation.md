# Live conversation

A line typed while a mission is going reaches the planner. The planner can answer, guide, replan, resume, stop, or start a different mission now. The conversation thread is saved and replayed from `data/conversation.json`. One action agent keeps the current plan until a new mission aborts it.

## Sub-features

This build:

- `clarify-in-conversation-file` — when Opero asks a clarifying question before a plan exists, that question is stored in `data/conversation.json` as an agent line. After reload, the Mission thread still shows the question. Live planner required (not fake).
- `clarify-keeps-earlier-answers` — after a vague booking mission, each follow-up answer goes to the planner with the saved thread. Opero does not re-ask for a city, service, or other fact already given. When clear enough, it writes a plan and starts. Live planner required.
- `status-keeps-plan` — a short status question such as "What is happening?" gets an answer and does not abort. End and steps stay. No abort-for-new sentence for that line.
- `new-mission-starts-now` — when the planner treats a line as a different mission, the previous mission is saved as Aborted and the new request starts immediately. The thread shows that the previous mission was stopped for the new one. New End and steps appear. No "Queued until the current mission finishes."
- `newer-mission-priority` — a second and third different mission while the agent is working each abort the prior one and start immediately. One Computer stays. The newest plan is on screen.
- `planner-choice` — from a live line the planner can answer, guide, replan (End stays), resume only when the person-check is finished, stop and ask, or abort and start a different mission. A status reply during a person-check leaves the hint as you driving.
- `thread-replay` — conversation lines are restored on reload from `data/conversation.json`. The same lines are in the thread after reload.
- `quiet-leftover` — a leftover live mission from before this build, or one quiet for 30 minutes, cannot block a new request. After migration or a quiet abort, a new Send starts a fresh mission. The thread does not show the old queue sentence.

Older map entries, still valid when driven:

- `planner-first` sends every composer line to the planner. Waiting is not a separate branch.
- `replan-line` during a stall or a verify wait replaces upcoming steps and keeps the End.
- `on-it` shows "I'm on it." when a plan is written and the action agent is sent.
- `wake-on-send` wakes a closed computer on a later Send when a plan already exists.
- `live-line` sends a chat line during planning, running, or waiting, including a person-check, in English and in Hebrew.
- `submit-stays` keeps a submit question on yes or no.
- `vague-first` asks one question before any plan or Computer work when the mission is vague.
- `answer-stays` keeps a reply to Opero's question on this mission.
- `stuck-steps` rewrites upcoming steps when the agent is stuck, keeps the end, and can post a short update on its own.

## How to get to it (user POV)

- Send a vague mission (e.g. book a Ministry of Transport appointment). Wait for the clarifying question. Reload and confirm the question is still in the thread and in `data/conversation.json` as an agent message.
- Answer that clarifying question with a city and service. If asked again, answer with a preference like "show me the closest". Confirm Opero does not re-ask for the same city/service; a plan appears or the next question asks only for something still missing.
- Start a clear mission that names a site and a fact. While it is live, Send a short status question such as "What is happening?"
- While that mission is still live, Send an unrelated mission. Confirm the abort-for-new sentence and the new plan.
- Send a third different mission. Confirm the latest plan wins and only one Computer is present.
- During a live mission, Send a status question, a course correction, a step change, a finished-check statement, a stop, and a different mission. During a person-check, Send the status question again.
- Send at least one user line and wait for an agent reply. Reload the page and scroll the thread.
- With an empty-looking thread after reload when an old mission had been stuck, Send a new clear mission.

## Driving it with control-ui

Preconditions:

- Doctor passes.
- Match the badge. Waiting on a question is the answer path. Running is the planner path. An empty plan is the vague-mission path. If that badge is not on screen, the journey is not reachable from here.
- Abort-for-new and newer-mission-priority need a live planner that can return `start`. Fake mode always replies and cannot prove those journeys.

- **Clarify in conversation file.** Doctor passes. Live planner (`npm run dev`, not fake). Send a vague booking mission with a long wait (planner latency). Snapshot after the question. Confirm `data/conversation.json` has an agent message with that question text. Reload via a fresh `snapshot` or page open and confirm the thread still shows it.
- **Clarify keeps earlier answers.** From that waiting clarifying state, Send a reply that names city and service. Wait for the next planner turn. If another question appears, it must not re-request the same city/service; if enough detail is present, End and steps appear. Capture thread and conversation file after each turn.
- **Status keeps plan.** While a mission is live, run `node .cursor/skills/verify-opero/bin/drive.mjs send <name> --text "What is happening?" --wait-ms 20000`. End and steps match the before snapshot. Thread has no "Stopping the previous mission to start this one." for that line.
- **New mission starts now.** While a mission is live, Send an unrelated mission. The thread contains "Stopping the previous mission to start this one." New End and steps appear. The pill can show Aborted then the new run. The thread does not show "Queued until the current mission finishes."
- **Newer mission priority.** While that second mission is live, Send a third unrelated mission. First (and second) become Aborted. One Computer stays. The newest End and steps are on screen.
- **Planner choice.** A status question gets an answer and the plan stays. A step change updates the steps and leaves the End field the same. During a person-check, a status reply leaves the hint as the person driving. Saying the check is finished returns the hint to Opero driving. Stop asks and leaves the mission stopped. A different mission aborts the previous one and starts.
- **Thread replay.** After at least one user line and one agent reply, reload the page. The same lines are in the thread.
- **Quiet leftover.** After a quiet abort or migration leaves an empty-looking thread with a leftover live mission, Send a new clear mission. It plans and starts. No old queue sentence.
- **Proof.** `state.json` records the sent frame, the thread, the End value, the steps, the badge, the mission pill, and the hint.

## Gotchas

- The composer sends an answer only after a question event on this page. A reloaded page can show Waiting and still send a mission frame. Record the frame the page sent.
- There is no special case for the word עדכון. Hebrew and English use the same path.
- A second Computer picture means this feature failed.
- Do not clear the running plan to make a fresh vague mission.
- Fake `converse` always returns a reply. Do not treat a fake-mode status reply as proof that a different mission aborts.
