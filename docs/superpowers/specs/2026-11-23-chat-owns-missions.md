# Chat owns the mission — verification claims

Branch: current workspace (`feat/challenge-takeover-status` or the working tree with this build).

## A different mission starts now

**Behavior.** When the planner treats a line as a different mission, the previous mission is saved as aborted and the new request starts immediately. The thread shows that the previous mission was stopped for the new one. The new End and steps appear.

**How to reach it.** Start a clear mission. While it is live, Send an unrelated mission.

**Proof.** Thread contains the abort-for-new sentence. Mission pill can show Aborted then the new run. New End and steps are on screen. No "Queued until the current mission finishes."

## A status line does not abort the mission

**Behavior.** A question about the current mission keeps the plan and does not abort.

**How to reach it.** During a live mission, Send a short status question such as "What is happening?"

**Proof.** End and steps stay. No abort-for-new sentence for that line.

## A newer mission takes priority

**Behavior.** A second mission while the agent is working aborts the first and starts the second immediately. No second browser opens. A third different mission does the same: the latest request wins.

**How to reach it.** While a mission is running, Send a second mission, then a third.

**Proof.** The first mission becomes Aborted. One Computer stays. The newest mission's plan is the one on screen. No "Queued until the current mission finishes."

## Thread replay after reload

**Behavior.** Conversation lines are restored on reload from `data/conversation.json`.

**How to reach it.** Send at least one user line and wait for an agent reply. Reload the page.

**Proof.** The same lines are in the thread after reload.

## Quiet leftover mission does not block

**Behavior.** A leftover live mission from before this build cannot block a new request. After migration or a quiet abort, a new Send starts a fresh mission.

**How to reach it.** With an empty-looking thread after reload when an old mission had been stuck, Send a new clear mission.

**Proof.** The new mission plans and starts. The thread does not show the old queue sentence.
