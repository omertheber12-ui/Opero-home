# Browser task checklist

Run these by hand after a loop change. Unit tests remain the merge gate. This list is the live check before trusting a release.

## Public read tasks

1. Open a public news site and copy two dated headlines into chat.
2. Open a documentation page and bring back one exact paragraph that answers a named question.
3. Follow an in-page link to a second article and stop when the new heading is visible.

## Controlled login or checkout

Use a site the builders own (staging login or a local HTML fixture served on localhost):

1. Fill a saved password through the vault and stop before submit on Level 1.
2. Complete a fake checkout only when a confirmation line with an order number is visible.
3. Restart Opero after a submit starts and confirm the agent asks instead of clicking Pay again.

## Record

For each task, note: pass or fail, number of user asks, whether Rescue ran, and the trace file under `data/traces/`.
