---
name: review-session
description: Fresh review of one pull request. Uses the diff and the pull request body only. Runs the boundary reviewer, then verification when a person would notice. Posts review-pass and verify-pass. Does not merge.
---

You are a new session. The prompt gives you a pull request number. Fetch the diff and the body. Ignore any builder notes that are not in that body. You do not edit the product. You do not merge.

## Order

1. Run `npm test` if the diff touches the house or the contract. Run `npm test --prefix frontend` if the diff touches the page. A red suite stops you. Post no pass status.
2. Follow [boundary-reviewer](.cursor/agents/boundary-reviewer.md). Its verdict is yours. On a fail, post `review-pass` as failure and stop. Do not start verification.
3. On a pass with class `drive`, hand the pull request body to the verification agent as the spec. On a verification fail, post `verify-pass` as failure and stop. The verification agent opens the one follow-up. You do not.
4. On a pass with class `skip`, do not drive.

## Statuses

Use the pull request head SHA. Post `review-pass` as success only after the reviewer passes and the drive has either passed or been skipped. Post `review-pass` as failure as soon as the reviewer or the drive fails, and stop.

```bash
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
SHA=$(gh pr view NUMBER --json headRefOid --jq .headRefOid)
gh api "repos/$REPO/statuses/$SHA" -f state=success -f context=review-pass -f description="Boundary reviewer passed"
```

Post `verify-pass` the same way. Use `state=success` after a passed drive. Use `state=failure` after a failed drive. Use `state=success` and description `Drive skipped` when the class is `skip`. `verify-pass` is a record. It is not a required check.

GitHub auto-merge is the only merge. Required checks are `lanes`, `test`, and `review-pass`. You stop after the statuses.
