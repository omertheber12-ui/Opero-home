# Verification claims

User-facing behaviors named by the four specs for `feat/challenge-takeover-status`. Each claim is what a person should see, how they reach it on http://127.0.0.1:8787, and what proves it. Network routing is not a claim.

## This build — Plan block has room in the Mission column

Follow-up CSS in `public/index.html` (`.plan-block` / `#thread` flex). Drive these two first. Needs a live plan (End filled, at least one step) and enough Mission history that the old flex shrink would collapse Plan. Fake or live server is fine. Reuse `http://127.0.0.1:8787` when it is already Opero.

### Plan section shows its content

**Behavior.** With a live plan (End filled and at least one step), the Plan section at the bottom of Mission is tall enough to show the Plan title, the End field, and the step texts without being collapsed to a thin strip. When Plan content is under ~40% of the Mission panel, Plan height stays close to its content height (not ~75px when content needs ~260px).

**How to reach it.** Open the house at ~1280×800 with an existing plan (End + steps) and a tall Mission `#thread` (many history lines). Look at the Plan block under the composer.

**Proof.** `.plan-block` client height is near its scroll/content height when content is under 40% of the Mission column (not shrunk to a thin strip). Plan title, End value, and step texts are readable in the viewport (or scrollable inside `.plan-block` if content exceeds the 40% cap). Measured height is not stuck near ~75px while content needs ~260px.

### Fixed window still holds with Plan room

**Behavior.** Giving Plan its content height does not break the fixed window: the document does not grow or scroll; Mission `#thread` still scrolls for long history; the composer stays visible.

**How to reach it.** Same setup as above (live plan + tall thread) on a wide window.

**Proof.** `document.documentElement.scrollHeight` matches the viewport (no page scroll). `#thread` has internal overflow and can scroll. Composer and app bar stay in the viewport.

## This build — fixed conversation window

Prior CSS layout claims (`public/index.html`). Drive when verifying the full fixed-window set. Fake or live server is fine: the claims are viewport and scroll behavior, not planner replies. Reuse `http://127.0.0.1:8787` when it is already Opero.

### Page stays one screen tall

**Behavior.** With enough Mission thread lines that they are taller than the panel, the browser document does not grow and the page itself does not scroll. Body and shell stay viewport-bounded.

**How to reach it.** Open the house on a wide window (~1280×800). Ensure `#thread` content is taller than the Mission panel (existing history, or enough visible lines that `#thread.scrollHeight` exceeds `#thread.clientHeight`).

**Proof.** `document.documentElement.scrollHeight` equals the viewport height (no document scroll). `body` and `.shell` do not extend past the viewport. The document scroll position cannot move the page.

### History scrolls inside Mission

**Behavior.** The conversation history scrolls inside the Mission `#thread` panel. The latest line stays reachable (stick-to-bottom / scrollable to end). Composer and app bar stay fixed in place.

**How to reach it.** Same tall-thread setup as above on a wide window.

**Proof.** `#thread` has `scrollHeight > clientHeight` and scrolling `#thread` reaches the latest line. Composer and `header.app-bar` remain fully in the viewport (their bounding boxes stay on screen) while the thread scrolls.

### Computer stays visible

**Behavior.** The Computer picture (or idle Computer panel) and Take control / I'm done remain visible beside the chat on a wide window.

**How to reach it.** Open the house at ~1280×800 with a tall Mission thread.

**Proof.** The Computer heading, the screen frame (picture or idle), and the buttons named Take control and I'm done (or Hebrew equivalents) are in the viewport beside the chat. Scrolling the thread does not push them off the page.

### Narrow layout

**Behavior.** At width ≤960px (stacked desk), the same rules hold: page does not grow; thread scrolls inside the Mission panel; Computer panel and its controls remain visible in the window.

**How to reach it.** Resize the viewport to width 960 or less (e.g. 900×800) with a tall Mission thread.

**Proof.** Document does not scroll. `#thread` scrolls internally to the latest line. Computer panel, Take control, and I'm done are visible in the window (stacked under Mission).

## This build — clarifying questions in the conversation file

Prior build claims. Needs a **live planner** (not `npm run dev:fake`): the bug is that the model was not receiving prior turns.

### Clarifying questions land in the conversation file

**Behavior.** When Opero asks a clarifying question before a plan exists, that question is stored in `data/conversation.json` as an agent line (same store as chat messages). Reloading the page still shows that question in the Mission thread.

**How to reach it.** Send a vague mission (e.g. book a Ministry of Transport appointment). Wait for the clarifying question. Reload.

**Proof.** The thread still shows the question after reload. The conversation file contains the question text as an agent message.

### A clarify follow-up keeps earlier answers

**Behavior.** After Opero asks for missing details, each follow-up answer goes back to the planner with the saved thread (original request, Opero's questions, and prior answers). Opero does not re-ask for a city, service, or other fact the person already gave in that thread. When the request is clear enough, it writes a plan and starts.

**How to reach it.** Send a vague booking mission. Answer the first clarifying question with a city and service. If asked again, answer with a preference like "show me the closest". Watch that Opero does not ask again for the same city/service already given.

**Proof.** The second or third agent question does not re-request facts already answered. A plan appears once enough detail is present, or a new question asks only for something still missing.

## This build — planner in the middle

The plan `planner_in_the_middle` is the behavior just built. Drive these seven. The sections below are older claims. Do not mark an older claim done because this build finished. Out of scope for this build: bot-check handoff, picture click/type/scroll, payment wording, the Pay question, one-time yes, a paused step, a different email, restart, three ineffective actions, the browser task list, a vague mission before any plan, and a newer waiting mission starting when the current one finishes.

### Every chat line reaches the planner

**Behavior.** Every composer line goes to the planner first. There is no waiting-on-user branch and no stay-on-this-mission split. A Hebrew line and an English line during Waiting reach the planner, and the reply addresses that sentence. The End and the steps stay.

**How to reach it.** While the mission pill says Waiting, type a Hebrew sentence and Send. Then type an English sentence and Send.

**Proof.** Each reply speaks to that sentence. The End value and the step texts are the same as before the Send. The thread does not start a new mission.

### A different mission waits

**Behavior.** A different mission during a live mission shows "Queued until the current mission finishes." The End and the steps stay.

**How to reach it.** While a mission is live, Send an unrelated mission.

**Proof.** The thread shows that exact sentence. The End and the steps are unchanged.

### A stalled or verify-wait line can replan

**Behavior.** A line during a stall or a verify wait can replan the upcoming steps. The End stays.

**How to reach it.** While the mission is stalled or Waiting on a verify question, Send a line that asks to change the upcoming steps and keep the end.

**Proof.** The upcoming step texts change. The End value is the same.

### The planner says it is on it

**Behavior.** The planner says "I'm on it." when it writes a plan and sends the action agent.

**How to reach it.** Send a mission that already names the site and the fact to bring back.

**Proof.** The thread shows "I'm on it." The End and the steps appear, and the Computer leaves the idle screen.

### Progress and work status

**Behavior.** The action agent posts readable progress. The page polls work_status directly while Running. A snapshot comes back. The worker does not wait on that read.

**How to reach it.** Send a mission and leave the page connected while the pill says Running.

**Proof.** The thread shows a short progress line. The page's own socket sends `work_status` and receives a snapshot while screen frames are still arriving.

### Rescue, thinking, and the trace

**Behavior.** On a stall, a failed open, a site error, or a used budget, rescue runs. A thinking line appears before the rescue question. The trace line is marked site or reasoning. A secret in the trace is `[secret]`, not the raw value.

**How to reach it.** Send a mission whose site fails to open. After the question, open that mission's file under `data/traces`.

**Proof.** The thread shows "Reviewing what went wrong…" before the question. The trace file has `class` of `site` or `reasoning` on the failure line. A vault secret that landed in that file appears only as `[secret]`.

### A later Send wakes a closed computer

**Behavior.** A later Send after the browser was closed wakes the computer when a plan already exists.

**How to reach it.** With a plan on screen and the Computer back on the idle screen, Send a line about this mission.

**Proof.** The Computer picture returns. The thread still answers. The End stays.

The page is one chat. The composer is the "Give a mission…" field and Send. The plan is the End field and the steps under Plan. The Computer is the picture, Take control, and I'm done.

## Bot check is tried, then handed over

**Behavior.** On a Cloudflare or Turnstile check, a Google sorry page, or a page that says "Performing security verification", Opero tries the check itself. The chat says it is trying. If the check is still there after those tries, the chat tells you to finish it and includes the Browserbase live-view URL when one exists. You finish the check there, then press I'm done. If the check clears, Opero keeps the mission and does not hand over the browser. A page that only says "just a moment" stays with Opero the whole time.

**How to reach it.** Send a mission that opens one of those pages. For the negative case, open a page whose only challenge text is "just a moment".

**Proof.** The thread shows a trying line, then a click, before any live-view handoff. The handoff appears only after the check is still there. On "just a moment" alone, Opero keeps driving and the thread does not post that handoff.

## Take control drives the Computer picture

**Behavior.** Take control stops the agent immediately. While you are driving, a click, a key, and the wheel on the Computer picture go to that same browser. Padding around the picture does not click. I'm done gives driving back, and the agent continues from the page you left.

**How to reach it.** With the Computer picture visible during a mission, press Take control. Click a link on the picture, type in a field, scroll. Press I'm done.

**Proof.** The picture changes from those inputs. The hint says you are driving, then that Opero is driving after I'm done. The next agent step starts from the page you left. A click on the empty margin does not move the page.

## Thinking line in the thread

**Behavior.** The thread shows one muted narration line while the loop works, such as opening a site or handing over a bot check. The next agent message or question removes that line. The line is loop narration, not hidden model reasoning.

**How to reach it.** Send a mission and watch the Mission thread.

**Proof.** One thinking line appears during the turn and is gone after the next message or question.

## Work status can be read without stalling the worker

**Behavior.** While a mission runs, a client can pull a snapshot of the mission, phase, step, last action, and whether a challenge is waiting. The worker does not wait on that read.

**How to reach it.** During a running mission, the connected page asks for work status.

**Proof.** A snapshot returns while the mission is still running, and the Computer keeps moving without waiting on that reply.

## A payment does not finish from wording alone

**Behavior.** A mission that pays, buys, orders, books, deletes, sends, subscribes, or transfers does not finish because the page shows the expected sentence. It finishes only when the page shows a confirmation, order, reference, or booking label and a token that includes a digit. If a submit already started and that proof is missing, Opero asks and does not click submit again.

**How to reach it.** Send a pay or order mission and land on a page that only contains the expected sentence. Repeat after a submit has started, on a page with no confirmation number.

**Proof.** The mission badge does not become Done. The thread asks instead. The Pay control is not clicked again.

## A Pay button asks before it is clicked

**Behavior.** A control named submit, pay, purchase, buy, place order, delete, remove, send, sign in, log in, sign up, confirm order, or checkout asks before Opero uses it, even when the actor did not mark it as a commit. Filling a saved detail does not ask for that reason. Enter asks only when the mission is a transaction and the current step is a commit step.

**How to reach it.** Run a mission until the Computer shows a Pay (or Sign in) control.

**Proof.** The thread asks "This step submits, deletes, sends, or changes an account. Should I continue?" before that control is activated.

## A yes approves one exact action

**Behavior.** On that submit question, yes, continue, approve, ok, כן, אישור, or המשך allows that one action once. A clear no does not run it, and Opero picks a different action. Any other reply asks the same question again. A different consequential action asks again. After the browser call has started, another consequential action is refused. If the submit may have landed, the thread says it will not be sent again.

**How to reach it.** When the submit question is in the thread, reply in the composer and Send. Then try a second submit, a vague reply, and a case where the first submit's result is unknown.

**Proof.** One yes performs that action once. A vague reply repeats the question. A second different submit asks again. An unknown submit is not clicked again, and the thread says it may have landed.

## A paused step does nothing

**Behavior.** When the current step is paused, Opero asks and does not navigate or click, including from a blank tab.

**How to reach it.** Start a mission whose current step is paused.

**Proof.** The thread says the step is paused. The Computer does not open the step's site and does not click.

## A different email stops sign-in

**Behavior.** If the mission names an email and the page shows a different email, Opero asks and does not sign out.

**How to reach it.** Send a mission that names an email, and open a page that shows another email.

**Proof.** The thread says the open account looks different and that Opero will not sign out. The page stays signed in as the other account.

## A restart does not repeat the last action

**Behavior.** If Opero restarts while a mission was running, the thread still shows that mission and says Opero restarted and will not repeat the last action. If a submit had started, it asks instead of clicking that control again. It does not perform the last action. If the computer cannot wake, the thread says so and the mission is not marked done. If the restored page already proves the end, the mission finishes.

**How to reach it.** Restart the app after a running mission, and again after a submit has started.

**Proof.** The plan is still on screen. The thread contains the restart sentence. The last control is not activated again. A failed wake is not shown as Done.

## The planner steps in when progress fails

**Behavior.** Three different actions that do not change the page call the planner, which may rewrite upcoming steps and keeps the same end. An action that made progress does not by itself rewrite the plan. The person can still edit the End field.

**How to reach it.** Run a mission that stays on one page through three ineffective actions. Compare with a mission whose action changes the page.

**Proof.** After the stall, upcoming steps can change and the End text is the same. After a real page change, the steps are not replaced just because an action succeeded.

## Ordinary failures go through Rescue before you are asked

**Behavior.** The fifth action of a strategy that makes no progress, a failed open, or a used-up action budget is reviewed before you are asked. You are not asked on the first failure. A bot check, a paused step, you driving, a secret, a phone code, a rejected saved detail, a wrong account, or a missing approval does not take that path. If that review itself fails, you are asked.

**How to reach it.** Send a mission whose site fails to open, or one that keeps acting without progress until the budget is used. Separately, hit a bot check.

**Proof.** The first failed open does not immediately become a "tell me how to continue" question. After the strategy or budget is exhausted, a question appears only after that review. A bot check still hands you the browser without that review question first.

## A thin page and a stale control stay on the same moment

**Behavior.** A page with almost no controls still lets Opero decide from that screenshot and that control list together. A click or type aimed at a control that is not on the current page is skipped.

**How to reach it.** Open a mission on a nearly empty page, then a page whose controls change before a click lands.

**Proof.** Opero continues from that page. It does not activate a control number that was not on the picture at that moment.

## A quiet house closes the browser and a later message wakes it

**Behavior.** Ten quiet minutes closes the browser. A later message wakes the same browser. Shutdown closes the session.

**How to reach it.** Leave the page idle for ten minutes, then Send again.

**Proof.** The Computer returns to the idle screen. The next Send brings the picture back on the same browser context.

## A trace separates a site failure from a reasoning failure

**Behavior.** A failed mission leaves a trace a person can read. Site failures are a navigation error, a bot check, or a site error page. Reasoning failures are a stall, an ungrounded finish, a policy refusal, or a rescue stop. Secret values appear as "[secret]".

**How to reach it.** After a failed mission, open that mission's trace under data/traces.

**Proof.** The failure line is marked site or reasoning, and a typed secret is not present in the file.

## The browser task list is the live check

**Behavior.** A short fixed list of public read tasks and one controlled login or checkout is what a person runs before trusting a loop change.

**How to reach it.** Open the browser task checklist and run one public read task and the controlled checkout item in the chat.

**Proof.** The checklist names those tasks. Running one read task copies page text into the thread. The checkout item finishes only when a confirmation with an order number is visible.

## A message during a live mission reaches the planner

**Behavior.** While a mission is planning, running, or waiting, a chat line is not a new mission. That includes a person-check, where you are driving and the mission is still running. The planner sees the sentence in English and in Hebrew. There is no special case for the word "עדכון". A line that arrives during a click waits until that click finishes, then the planner speaks. Work already done on the page stays done.

**How to reach it.** During a running mission, type in the composer and Send. Do the same during a bot check, in Hebrew and in English, and once while the Computer is mid-click.

**Proof.** The thread does not treat the line as a brand-new mission. A planner reply appears after the in-flight click finishes. The page you already changed stays changed.

## The planner can answer, guide, replan, resume, stop, or start

**Behavior.** From that line, the planner can answer in the thread and keep going, save a note and continue only when Opero is driving, replace upcoming steps while the End stays the same, take the screen back only when it decides the person-check is finished, stop and ask, or abort the current mission and start a different one now. A status reply during a person-check does not click and does not take the screen back. Only the finished-check decision returns driving to Opero.

**How to reach it.** During a live mission, Send a status question, a course correction, a request to change the steps, a statement that the check is finished, a request to stop, and a clearly different mission. Send the status question again while you are driving a bot check.

**Proof.** A status question gets an answer and the plan stays. A step change updates the steps and leaves the End field the same. During a person-check, a status reply leaves the hint as you driving. Saying the check is finished is the case that returns the hint to Opero driving. Stop asks and leaves the mission stopped. A different mission shows the previous mission as Aborted and the new plan starts.

## A different mission starts now

**Behavior.** When the planner says the line is a different mission, the previous mission is saved as aborted and the new request starts immediately. A planner failure does not start a new mission and does not change the current one. A mission quiet for 30 minutes is also aborted so it cannot block the next request. The conversation thread is restored on reload.

**How to reach it.** While one mission is running, Send an unrelated mission. Separately, send a line the planner cannot read. Reload the page and confirm the thread history is still there.

**Proof.** The thread shows that the previous mission was stopped for the new one. The new End and steps appear. On a planner failure, the thread says the current mission is unchanged. After reload, the same lines are in the thread.

## A submit question stays yes or no

**Behavior.** The model does not grant or decline a submit. That reply stays on the yes/no path above.

**How to reach it.** When the submit question is showing, Send yes, no, and a sentence that is not a yes or no.

**Proof.** Yes runs that action once. No does not. Any other sentence asks the submit question again and does not approve it as planner guidance.

## A vague mission asks before any computer work

**Behavior.** Before a plan exists, a vague mission gets one clarifying question. No browser opens and no action starts. Your answer comes back to the planner. It asks again only if it still cannot write an accurate plan. When the request is clear, it writes the plan and then starts the one action agent.

**How to reach it.** Send a mission with no office, date, or person. Answer the question. Then send a mission that already names the site and the fact to bring back.

**Proof.** After the vague Send, the thread asks one question, the steps stay empty, and the Computer stays on the idle screen. After a sufficient answer, steps appear and the Computer wakes. A clear mission skips the question and starts.

## An answer to Opero's question stays with this mission

**Behavior.** If Opero just asked which account, a phone code, a saved detail, or whether to submit, your reply stays with that mission and the plan stays. If Opero did not just ask, the line goes to the planner and the running work continues.

**How to reach it.** Reply when the mission badge is Waiting. Then, while the badge is Running, ask what is happening.

**Proof.** The waiting reply does not replace the plan. The status question gets an answer from the current screen and plan, the steps stay, and the Computer keeps working.

## A newer mission takes priority

**Behavior.** A second mission while the agent is working aborts the first and starts the second immediately. No second browser opens. A third different mission does the same: the latest request wins.

**How to reach it.** While a mission is running, Send a second mission, then a third.

**Proof.** The first mission becomes Aborted. One Computer stays. The newest mission's plan is the one on screen.

## A stuck agent gets new steps on the same screen

**Behavior.** The planner watches the one agent's screen and plan. If the agent is stuck, it rewrites upcoming steps. The end stays unless you change it. Sometimes it posts a short update on its own after a step finishes or when a person-check starts. The written plan does not decide whether the agent may start.

**How to reach it.** Let a mission stall, or ask the planner to change the approach. Watch the thread after a step finishes and when a bot check starts, without typing.

**Proof.** Upcoming steps change and the End stays unless you edit it. The same Computer continues. An unsolicited short update can appear in the thread. A second mission never opens a second picture.
