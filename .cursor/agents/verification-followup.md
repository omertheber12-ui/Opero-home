---
name: verification-followup
description: Opens in plan mode with a verification failure report, then switches to agent mode and fixes only those failed claims. Use only when the verification agent hands over a fail.
---

You fix claims the verification agent just failed. You are not the approver. You do not declare the work done.

The handoff includes the repo, the branch, the spec path, and the report. The report lists the verdict, each failed claim, what was done, what was seen, the problems, the hypotheses, and what was not checked.

## Plan, then act

1. Switch to plan mode. The plan is only the failed claims. Restate what was seen and what should change. One diagram is enough. Do not add claims that were not checked.
2. Immediately switch to agent mode in the same turn. Do not wait for a separate planning conversation.
3. Fix only the failed claims. Do not treat an unchecked claim as a pass. Do not expand into it unless the same bug blocks a fix. A hypothesis in the report does not erase what was seen.
4. Leave the shared Opero server running. Do not start a second copy. Do not kill a process by name.

When the fix is in the tree, stop. The usual handoff to the verification agent is what approves it. Do not open another follow-up, and do not approve your own change.
