# Issue Lifecycle Implementation Plan

> Generated: 2026-04-30
> Based on: `.github/workflows/ISSUE_LIFECYCLE_STATE_DIAGRAM.md`

---

## Gap Analysis

| #   | Gap                                                                                                  | Severity     | Effort |
| --- | ---------------------------------------------------------------------------------------------------- | ------------ | ------ |
| G1  | Duplicate `const totalRounds` in `ai-code-review.yml` — JS SyntaxError blocks every PR review run    | 🔴 Critical  | XS     |
| G2  | AI Code Review is all placeholder — no actual AI call, round tracking not wired to review logic      | 🔴 Critical  | L      |
| G3  | Stage 3 AC check hardcoded to pass — `echo "criteria_passed=true"`                                   | 🔴 Critical  | M      |
| G4  | Stage 1 PR format check not implemented — workflow skips to generic placeholder comment              | 🔴 Critical  | M      |
| G5  | Auto Abandoned (30-day stale) not implemented — explicitly noted "Not implemented" in diagram        | 🟡 Important | S      |
| G6  | `needs-details` label never applied by intake — `issue-intake.js` defers all quality checks to PM    | 🟡 Important | S      |
| G7  | `handle-copilot-review-changes.yml` uses undefined `exec()` — runtime failure on `changes_requested` | 🟡 Important | S      |
| G8  | `rebalance-on-close.yml` uses only `GITHUB_TOKEN` — fails for user-owned Projects v2                 | 🟡 Important | XS     |
| G9  | No auto-merge at Stage 6 — `manual-approval` job has `if: false`                                     | 🟠 Low       | M      |
| G10 | No PR→issue closure link enforcement                                                                 | 🟠 Low       | XS     |

---

## Phase 1 — Critical Bug Fixes (~1 hour)

### 1.1 Fix duplicate `const totalRounds` declaration

**File:** `.github/workflows/ai-code-review.yml` (lines 118–119)

**Change:** Remove the second `const totalRounds = 3;` declaration. This causes a `SyntaxError` at runtime, blocking the entire review job.

**Verification:**

- Open a test PR → confirm the `ai-code-review` job runs without a JS `SyntaxError` in the "Post initial review comment" step
- Check workflow run logs for `Unexpected identifier 'totalRounds'` no longer appearing

---

### 1.2 Fix `handle-copilot-review-changes.yml` — undefined `exec` calls

**File:** `.github/workflows/handle-copilot-review-changes.yml`

**Change:** Replace bare `exec()` calls (undefined in `actions/github-script`) with `const { execSync } = require('child_process')` and wrap in a `try/catch`. The git commit+push within a PR workflow also requires the checkout to fetch the head ref.

**Verification:**

- Submit a PR → add a "changes requested" review
- Confirm the `handle_changes_requested` job completes without `exec is not defined` error

---

### 1.3 Fix `rebalance-on-close.yml` to use PAT for user-owned Projects v2

**File:** `.github/workflows/rebalance-on-close.yml`

**Change:** Add `TOKEN: ${{ secrets.PROJECTS_TOKEN }}` to the env block of the `Rebalance Project Status` step, matching the pattern already used in `issue-intake.yml`.

**Verification:**

- Close any issue
- Confirm the `rebalance` job completes without `GraphQL error: ... 401` or `Project not found` errors

---

## Phase 2 — Core Flow Completeness (~1 day)

### 2.1 Implement `needs-details` label in issue-intake

**File:** `scripts/issue-intake.js`

**Change:** After stripping lane labels, check for minimum quality thresholds:

- Body is non-empty
- Body length > 50 chars
- Body contains at least one heading (`##`) or checkbox (`- [ ]`)

On fail: apply `needs-details` label and post a comment explaining what's missing.
Gate the PM review in `issue-intake.yml`:

```yaml
if: "!contains(steps.intake.outputs.labels, 'needs-details')"
```

The `needs-details → Auto_Validation` transition is already covered by `on: issues: types: [opened, edited]`.

**Verification:**

- Create a test issue with an empty body → confirm `needs-details` label is applied and a comment is posted
- Edit the issue to add a proper body → confirm `needs-details` label is removed and PM review runs

---

### 2.2 Implement stale/auto-abandon workflow

**File:** Create `.github/workflows/stale-issues.yml`

**Change:** New workflow using `actions/stale@v9` that:

- Runs on a daily schedule (`cron: '0 9 * * *'`)
- Targets issues with `needs-details` label and no update in 30 days
- Applies `auto-abandoned` label and posts a comment:
  > "This issue has been automatically closed due to inactivity. Reopen if you have the required details."
- Closes the issue

**Verification:**

- Manually trigger the workflow via `workflow_dispatch`
- Confirm issues with `needs-details` older than 30 days are labeled and closed
- Confirm issues without `needs-details` are not affected

---

### 2.3 Implement Stage 1 PR format validation

**File:** `.github/workflows/ai-code-review.yml`

**Change:** Replace the "Post initial review comment (placeholder)" step with a real format check using `actions/github-script` that validates:

1. PR title follows `type: description` convention — regex: `/^(fix|feat|chore|docs|refactor|test|style|perf):/i`
2. PR body is not empty and is ≥ 100 chars
3. PR body contains a `Closes #NNN` or `Fixes #NNN` reference
4. PR body has no empty template sections (e.g. `### Description\n\n###`)

On failure: post a comment listing exactly what failed, add `pr-format-invalid` label, and exit with `core.setFailed()` so subsequent jobs are skipped.
On success: add `pr-format-valid` label.

**Verification:**

- Open a PR with no issue link → confirm job fails with a descriptive comment and `pr-format-invalid` label
- Open a well-formed PR → confirm `pr-format-valid` label is added and job continues to Stage 2

---

### 2.4 Implement real AI code review (Stage 2) with round tracking

**File:** Create `scripts/ai-code-review.js`

**Change:** New Node.js script (modeled after `scripts/pm-review.js`) that:

1. Reads `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` from env
2. Fetches PR diff using GitHub REST API
3. Reads `REVIEW_ROUND` env var (passed from `steps.review_check.outputs.review_round`)
4. Builds prompt with: project conventions, PR diff, linked issue acceptance criteria, and review dimensions:
   - Architecture & design
   - Code quality
   - Testing adequacy
   - Error handling
   - Security
   - Documentation
   - Performance
   - Patterns & conventions
5. Calls AI and parses structured JSON response:
   ```json
   {
     "approved": false,
     "issues": [
       {
         "file": "...",
         "line": 12,
         "severity": "error",
         "description": "...",
         "suggestion": "..."
       }
     ],
     "summary": "..."
   }
   ```
6. Posts review comment with round number, issues found, and suggestions
7. Sets job outputs: `approved`, `escalate`

Wire the workflow to call this script in the `ai-code-review` job and branch to escalation vs. Stage 3 based on outputs.

**Verification:**

- Open a PR with an intentional issue (e.g., hardcoded secret, missing error handling)
- Confirm AI posts a review comment citing specific files and lines
- Confirm comment shows correct round number (Round 1/3, 2/3, 3/3)
- After 3 rounds still failing → confirm `ai-review-escalated` label is added and maintainer is assigned

---

### 2.5 Implement real Stage 3 Acceptance Criteria check

**File:** `.github/workflows/ai-code-review.yml` (`acceptance-criteria` job)

**Change:** Replace `echo "criteria_passed=true"` with a script that:

1. Extracts the linked issue number from the PR body using `Closes #NNN` / `Fixes #NNN` regex
2. Fetches the issue body and extracts the `## Acceptance Criteria` section
3. Asks the AI: _"Given these acceptance criteria and this PR diff, are all criteria met?"_
   Expected JSON response: `{ "met": false, "unmet": ["...", "..."], "summary": "..." }`
4. If `met: false` → post comment listing unmet criteria, add `ac-not-met` label, fail the step
5. If `met: true` → post brief confirmation comment, add `ac-verified` label

**Verification:**

- Merge a PR with a linked issue → confirm AC check runs
- Test with a PR whose diff does not address one of the issue's AC items → confirm the step fails and lists the unmet criteria

---

## Phase 3 — Polish & Auto-merge (~half day)

### 3.1 Implement Stage 6 auto-merge

**File:** `.github/workflows/ai-code-review.yml`

**Change:** Replace the `manual-approval` job (`if: false`) with an `auto-merge` job triggered by maintainer PR approval:

- Trigger: `pull_request_review: types: [submitted]` + `if: github.event.review.state == 'approved'`
- Verify PR has `awaiting-approval` label (set by `ready-for-approval` job)
- Call `github.rest.pulls.merge` with `merge_method: 'squash'`
- Remove `awaiting-approval` label, add `merged` label
- Post a final comment linking to the merge commit SHA

**Verification:**

- Submit a PR that passes all automated gates
- Approve it as the maintainer
- Confirm auto-merge fires and the PR is squash-merged
- Confirm the linked issue is closed via the `Closes #NNN` reference

---

### 3.2 Enforce `Closes #NNN` → issue auto-close linkage

**Note:** This is already covered by the Stage 1 format validation gate (2.3 above). GitHub natively closes linked issues on merge when the body contains `Closes #NNN`. The Stage 1 check enforces that this reference is always present.

**Verification:**

- Merge any PR with `Closes #NNN` in the body
- Confirm the linked issue is automatically closed by GitHub

---

## Verification Test Matrix

| Test                                     | Expected Result                                               | Workflow / Script                   |
| ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| Create issue with empty body             | `needs-details` label applied, details comment posted         | `issue-intake.yml`                  |
| Edit issue to add proper body            | `needs-details` removed, PM review runs                       | `issue-intake.yml`                  |
| `needs-details` issue untouched 30+ days | `auto-abandoned` label, issue closed                          | `stale-issues.yml`                  |
| Open PR without `Closes #NNN`            | Stage 1 fails, `pr-format-invalid` label, descriptive comment | `ai-code-review.yml`                |
| Open PR with code quality issue          | AI posts Round 1 review with specific file/line issues        | `ai-code-review.yml`                |
| AI fails to approve after 3 rounds       | `ai-review-escalated` label, maintainer assigned              | `ai-code-review.yml`                |
| AC not met in PR                         | Stage 3 fails, unmet criteria listed, `ac-not-met` label      | `ai-code-review.yml`                |
| CI tests fail                            | Stage 4 fails, `ci-failing` label                             | `ai-code-review.yml`                |
| Maintainer approves PR                   | Auto-merge fires, linked issue closes                         | `ai-code-review.yml`                |
| Issue closes                             | Lanes rebalance in Project v2 without 401 errors              | `rebalance-on-close.yml`            |
| Maintainer requests changes on PR        | Session context posted, `changes-requested` label applied     | `handle-copilot-review-changes.yml` |

---

## Suggested Implementation Order

```
Phase 1 — Bug Fixes (~1 hour):
  G1 → 1.1  Fix duplicate const totalRounds        ← unblocks all PR review testing
  G7 → 1.2  Fix exec() undefined                   ← unblocks review-iteration testing
  G8 → 1.3  Fix rebalance-on-close.yml PAT          ← unblocks lane rebalancing

Phase 2 — Core Flow (~1 day):
  G6 → 2.1  Implement needs-details in intake       ← enables validation failure path
  G5 → 2.2  Create stale-issues.yml                 ← completes needs-details terminal state
  G4 → 2.3  Implement Stage 1 format check          ← gates PR entry
  G2 → 2.4  Create scripts/ai-code-review.js        ← core Stage 2 implementation
  G3 → 2.5  Implement real Stage 3 AC check         ← completes Stage 3

Phase 3 — Polish (~half day):
  G9  → 3.1  Implement auto-merge                   ← completes Stage 6
  G10 → 3.2  Already covered by 2.3 Stage 1 gate
```
