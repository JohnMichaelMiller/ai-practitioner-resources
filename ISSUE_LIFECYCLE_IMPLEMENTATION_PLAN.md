# Issue Lifecycle Implementation Plan

> Generated: 2026-04-30
> Based on gap analysis of [ISSUE_LIFECYCLE_STATE_DIAGRAM.md](.github/workflows/ISSUE_LIFECYCLE_STATE_DIAGRAM.md) vs. current codebase

---

## Gap Analysis Summary

| #   | Gap                                                                                                  | Severity     | Effort |
| --- | ---------------------------------------------------------------------------------------------------- | ------------ | ------ |
| G1  | Duplicate `const totalRounds` in `ai-code-review.yml` — JS SyntaxError at runtime                    | 🔴 Critical  | XS     |
| G2  | AI Code Review is all placeholder — no actual AI call, round tracking not wired                      | 🔴 Critical  | L      |
| G3  | Stage 3 Acceptance Criteria hardcoded to pass — `echo "criteria_passed=true"`                        | 🔴 Critical  | M      |
| G4  | Stage 1 PR format check not implemented                                                              | 🔴 Critical  | M      |
| G5  | Auto Abandoned (30-day stale) not implemented — explicitly noted "Not implemented"                   | 🟡 Important | S      |
| G6  | `needs-details` label never applied by intake — `issue-intake.js` defers all quality checks to PM    | 🟡 Important | S      |
| G7  | `handle-copilot-review-changes.yml` uses undefined `exec()` — runtime failure on `changes_requested` | 🟡 Important | S      |
| G8  | `rebalance-on-close.yml` uses only `GITHUB_TOKEN` — fails for user-owned Projects v2                 | 🟡 Important | XS     |
| G9  | No auto-merge at Stage 6 — `manual-approval` job has `if: false`                                     | 🟠 Low       | M      |
| G10 | No PR→issue closure link enforcement                                                                 | 🟠 Low       | XS     |

---

## Phase 1 — Critical Bug Fixes (~1 hour)

### 1.1 Fix duplicate `const totalRounds` declaration (G1)

**File:** `.github/workflows/ai-code-review.yml` (lines 118–119)

**Change:** Remove the second `const totalRounds = 3;` declaration. This causes a `SyntaxError` at runtime, blocking the entire review job.

**Verification:**

- Open a test PR → confirm the `ai-code-review` job runs without a JS `SyntaxError` in the "Post initial review comment" step
- Check workflow run logs for `Unexpected identifier 'totalRounds'` no longer appearing

---

### 1.2 Fix `handle-copilot-review-changes.yml` — undefined `exec` calls (G7)

**File:** `.github/workflows/handle-copilot-review-changes.yml`

**Change:** Replace bare `exec()` calls (which are `undefined` in `actions/github-script`) with `const { execSync } = require('child_process')` and wrap in a `try/catch`. The git commit+push within a PR workflow also requires the checkout to fetch the head ref.

**Verification:**

- Submit a PR → add a "changes requested" review
- Confirm the `handle_changes_requested` job completes without `exec is not defined` error

---

### 1.3 Fix `rebalance-on-close.yml` to use PAT for user-owned Projects v2 (G8)

**File:** `.github/workflows/rebalance-on-close.yml`

**Change:** Add `TOKEN: ${{ secrets.PROJECTS_TOKEN }}` to the env block of the `Rebalance Project Status` step, matching the pattern already used in `issue-intake.yml`.

**Verification:**

- Close any issue
- Confirm the `rebalance` job completes without `GraphQL error: ... 401` or `Project not found` errors

---

## Phase 2 — Core Flow Completeness (~1 day)

### 2.1 Implement `needs-details` label in issue-intake (G6)

**File:** `scripts/issue-intake.js`

**Change:** After stripping lane labels, check for minimum quality thresholds:

- Non-empty body
- Body length > 50 characters
- Body contains at least one heading (`##`) or checkbox (`- [ ]`)

If failing: apply `needs-details` label and post a comment explaining what's missing.
Gate the PM review in `issue-intake.yml`:

```yaml
if: "!contains(steps.intake.outputs.labels, 'needs-details')"
```

The `needs-details` → `Auto_Validation` re-trigger is already covered by `on: issues: types: [opened, edited]`.

**Verification:**

- Create a test issue with an empty body → confirm `needs-details` label is applied and a comment is posted
- Edit the issue to add a proper body → confirm `needs-details` label is removed and PM review runs

---

### 2.2 Implement stale/auto-abandon workflow (G5)

**File:** Create `.github/workflows/stale-issues.yml`

**Change:** New workflow using `actions/stale@v9` that:

- Runs on a daily schedule (`cron: '0 9 * * *'`)
- Targets issues with `needs-details` label and no update in 30 days
- Applies `auto-abandoned` label and posts a comment:
  _"This issue has been automatically closed due to inactivity. Reopen if you have the required details."_
- Closes the issue

**Verification:**

- Manually trigger the workflow via `workflow_dispatch`
- Confirm issues with `needs-details` older than 30 days are labeled and closed
- Confirm issues without `needs-details` are not affected

---

### 2.3 Implement Stage 1 PR format validation (G4)

**File:** `.github/workflows/ai-code-review.yml`

**Change:** Replace the "Post initial review comment (placeholder)" step with a real format check using `actions/github-script` that validates:

1. PR title follows `type: description` convention (regex: `/^(fix|feat|chore|docs|refactor|test|style|perf):/i`)
2. PR body is not empty and is ≥ 100 chars
3. PR body contains a `Closes #NNN` or `Fixes #NNN` reference
4. PR body has no empty template sections (e.g., `### Description\n\n###`)

On failure: post a comment listing exactly what failed, add `pr-format-invalid` label, and call `core.setFailed()` so subsequent jobs are skipped.
On success: add `pr-format-valid` label and continue.

**Verification:**

- Open a PR with no issue link → confirm job fails with a descriptive comment and `pr-format-invalid` label
- Open a well-formed PR → confirm `pr-format-valid` label is added and job continues to Stage 2

---

### 2.4 Implement real AI code review — Stage 2 (G2)

**File:** Create `scripts/ai-code-review.js`

**Change:** New script similar in structure to `pm-review.js`. The script should:

1. Read `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` from env (prefer Anthropic)
2. Fetch PR diff using GitHub REST API (`pulls.get` with `Accept: application/vnd.github.v3.diff`)
3. Build prompt with: project conventions, full diff, linked issue acceptance criteria, and review dimensions:
   - Architecture & design
   - Code quality
   - Testing adequacy
   - Error handling
   - Security (OWASP Top 10)
   - Documentation
   - Performance
   - Patterns & conventions
4. Call AI, parse structured JSON response:
   ```json
   {
     "approved": false,
     "issues": [
       {
         "file": "...",
         "line": 42,
         "severity": "high",
         "description": "...",
         "suggestion": "..."
       }
     ],
     "summary": "..."
   }
   ```
5. Post review comment with round number (`REVIEW_ROUND` env var), issues found, and suggestions
6. Exit code 0 with output `approved=true` if approved; exit code 1 otherwise

Wire the workflow to:

- Replace the placeholder `ai-code-review` job steps with `node scripts/ai-code-review.js`
- Pass `REVIEW_ROUND: ${{ steps.review_check.outputs.review_round }}` as env
- After round 3 with `approved=false`: add `ai-review-escalated` label, assign maintainer

**Verification:**

- Open a PR with intentional issues (e.g., hardcoded string, missing error handling)
- Confirm AI posts a review comment citing specific files and lines
- Confirm the comment correctly shows the round number
- After 3 rounds still failing → confirm `ai-review-escalated` label and maintainer assigned

---

### 2.5 Implement real Stage 3 Acceptance Criteria check (G3)

**File:** `.github/workflows/ai-code-review.yml` (`acceptance-criteria` job)

**Change:** Replace `echo "criteria_passed=true"` with a script that:

1. Fetches the linked issue number from the PR body (`/(?:Closes|Fixes)\s+#(\d+)/i`)
2. Fetches the issue body and extracts the `## Acceptance Criteria` section
3. Fetches the PR diff
4. Asks the AI: _"Given these acceptance criteria and this PR diff, are all criteria met?"_
   Response: `{ "met": false, "unmet": ["AC item text"], "summary": "..." }`
5. If `met: false` → post comment listing unmet criteria, add `ac-not-met` label, fail the step
6. If `met: true` → post brief confirmation, add `ac-verified` label

**Verification:**

- Merge a PR with a linked issue → confirm AC check runs and passes
- Open a PR whose diff does not address one of the issue's AC items → confirm the step fails and lists the unmet criteria

---

## Phase 3 — Polish & Auto-merge (~half day)

### 3.1 Implement Stage 6 auto-merge (G9)

**File:** `.github/workflows/ai-code-review.yml`

**Change:** Replace the `manual-approval` job (`if: false`) with an `auto-merge` workflow triggered by a separate `pull_request_review` event:

```yaml
on:
  pull_request_review:
    types: [submitted]

jobs:
  auto-merge:
    if: github.event.review.state == 'approved'
    steps:
      - uses: actions/github-script@v7
        with:
          script: |
            await github.rest.pulls.merge({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number,
              merge_method: 'squash'
            });
```

Also: remove `awaiting-approval` label and add `merged` label; post a final comment with the merge commit SHA.

**Verification:**

- Submit a PR → approve it as the maintainer
- Confirm auto-merge fires and the PR is squash-merged
- Confirm the linked issue is closed via `Closes #NNN`

---

### 3.2 Enforce `Closes #NNN` → issue auto-close linkage (G10)

**Note:** GitHub natively closes linked issues on merge when `Closes #NNN` is in the PR body. The Stage 1 format check (task 2.3) enforces this link is present — no additional workflow required.

**Verification:**

- Merge a PR with `Closes #NNN` in the body
- Confirm the linked issue is automatically closed by GitHub

---

## Verification Test Matrix

| Test                                     | Expected Result                                         | Workflow/Script                     |
| ---------------------------------------- | ------------------------------------------------------- | ----------------------------------- |
| Create issue with empty body             | `needs-details` label applied, details comment posted   | `issue-intake.yml`                  |
| Edit issue to add proper body            | `needs-details` removed, PM review runs                 | `issue-intake.yml`                  |
| `needs-details` issue untouched 30+ days | `auto-abandoned` label, issue closed                    | `stale-issues.yml`                  |
| Open PR without `Closes #NNN`            | Stage 1 fails, `pr-format-invalid` label                | `ai-code-review.yml`                |
| Open PR with code quality issue          | AI posts round 1 review with specific file/line issues  | `ai-code-review.yml`                |
| AI fails to approve after 3 rounds       | `ai-review-escalated`, maintainer assigned              | `ai-code-review.yml`                |
| AC not met in PR                         | Stage 3 fails, lists unmet criteria, `ac-not-met` label | `ai-code-review.yml`                |
| CI tests fail                            | Stage 4 fails                                           | `ai-code-review.yml`                |
| Maintainer approves PR                   | Auto-merge fires, linked issue closes                   | `ai-code-review.yml`                |
| Issue closes                             | Lanes rebalance in Project v2 without errors            | `rebalance-on-close.yml`            |
| Maintainer requests changes on PR        | Session context posted, `changes-requested` label       | `handle-copilot-review-changes.yml` |

---

## Suggested Implementation Order

```
Phase 1 (fixes, ~1 hour):
  1.1  G1  Duplicate const totalRounds        ← unblocks all PR review testing
  1.2  G7  exec() undefined in handle-review  ← unblocks review-iteration testing
  1.3  G8  rebalance-on-close PAT             ← unblocks lane rebalancing

Phase 2 (core flow, ~1 day):
  2.1  G6  needs-details intake label         ← enables validation failure path
  2.2  G5  stale-issues.yml                   ← completes needs-details terminal state
  2.3  G4  Stage 1 real PR format check       ← gates PR entry
  2.4  G2  Real AI code review (Stage 2)      ← core Stage 2 implementation
  2.5  G3  Real AC check (Stage 3)            ← completes Stage 3

Phase 3 (polish, ~half day):
  3.1  G9  Auto-merge (Stage 6)               ← completes Stage 6
  3.2  G10 Close linkage                      ← already covered by Stage 1 gate
```
