$REPO = "JohnMichaelMiller/ai-practitioner-resources"
$OWNER = "JohnMichaelMiller"
$PROJECT_NUM = 5
$results = @()

function New-PathIssue {
  param($pathNum, $title, $body)
  $url = gh issue create --repo $REPO --title $title --label "workflow-path-test" --label "on the bench" --body $body
  $num = ($url -split "/")[-1]
  gh project item-add $PROJECT_NUM --owner $OWNER --url $url | Out-Null
  $script:results += [PSCustomObject]@{
    Path  = $pathNum
    Issue = $num
    URL   = $url
    Exit  = ($title -replace '\[Workflow Path Test\] ', '' -replace ' via .*', '')
  }
  Write-Host "Path $pathNum created: #$num $url"
}

# ─── PATH 1 ───────────────────────────────────────────────────────────────────
$body = @"
## Path 1 of 26 | Exit: Auto_Abandoned

**Lane:** Pre-backlog (validation failure path)

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → issue submitted → ``Auto_Validation``
   ↳ Expected state: Validation gate running, checking required fields

3. ``Auto_Validation`` → validation fails → ``Validation_Failed``
   ↳ Expected state: Missing or invalid fields detected

4. ``Validation_Failed`` → request details → ``Needs_Details``
   ↳ Expected state: Label **needs-details** applied; awaiting user response

5. ``Needs_Details`` → no response after 30 days → ``Auto_Abandoned`` → ``[*]``
   ↳ Expected state: Issue closed as **not planned**

---

## Labels

- Step 4: label ``needs-details`` applied

---

## Exit

**Exit state:** Auto_Abandoned
**Close reason:** not planned

---

- [ ] Path followed correctly
"@
New-PathIssue 1 "[Workflow Path Test] Auto_Abandoned via Validation Failure" $body

# ─── PATH 2 ───────────────────────────────────────────────────────────────────
$body = @"
## Path 2 of 26 | Exit: Closed_Rejected

**Lane:** Pre-implementation (PM triage rejection)

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → issue submitted → ``Auto_Validation``
   ↳ Expected state: Validation gate running

3. ``Auto_Validation`` → validation passes → ``Backlog``
   ↳ Expected state: Issue in backlog, awaiting PM triage

4. ``Backlog`` → to triage → ``PM_Triage``
   ↳ Expected state: PM review in progress

5. ``PM_Triage`` → reject (out of scope) → ``Triage_Rejected``
   ↳ Expected state: Issue marked out of scope; label **implementation ready** never applied

6. ``Triage_Rejected`` → close → ``Closed_Rejected`` → ``[*]``
   ↳ Expected state: Issue closed as **not planned**

---

## Labels

- No lane labels applied (issue rejected before lane assignment)

---

## Exit

**Exit state:** Closed_Rejected
**Close reason:** not planned

---

- [ ] Path followed correctly
"@
New-PathIssue 2 "[Workflow Path Test] Closed_Rejected via PM Triage Rejection" $body

# ─── PATH 3 ───────────────────────────────────────────────────────────────────
$body = @"
## Path 3 of 26 | Exit: Manually_Completed

**Lane:** At_Bat (direct assignment, no lane progression)

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → issue submitted → ``Auto_Validation``
   ↳ Expected state: Validation gate running

3. ``Auto_Validation`` → validation passes → ``Backlog``
   ↳ Expected state: Issue in backlog

4. ``Backlog`` → to triage → ``PM_Triage``
   ↳ Expected state: Awaiting PM review

5. ``PM_Triage`` → approve and assign → ``Assigned_Lane`` → ``At_Bat``
   ↳ Expected state: Label **at bat** applied; label **on the bench** removed

6. ``At_Bat`` → verify AC → ``AC_Check`` → AC ready → ``Dev_Assigned``
   ↳ Expected state: Label **implementation ready** applied; developer assigned

7. ``Dev_Assigned`` → manual close without PR → ``Manual_Close_Check`` → ``Manual_Completed`` → ``[*]``
   ↳ Expected state: Issue closed as **completed** without a merged PR

---

## Labels

- Step 5: label ``at bat`` applied; label ``on the bench`` removed
- Step 6: label ``implementation ready`` applied

---

## Exit

**Exit state:** Manually_Completed
**Close reason:** completed (no PR)

---

- [ ] Path followed correctly
"@
New-PathIssue 3 "[Workflow Path Test] Manually_Completed via At_Bat Direct" $body

# ─── PATH 4 ───────────────────────────────────────────────────────────────────
$body = @"
## Path 4 of 26 | Exit: Manually_Completed

**Lane:** On_Deck → rebalance → At_Bat

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → issue submitted → ``Auto_Validation``
   ↳ Expected state: Validation gate running

3. ``Auto_Validation`` → validation passes → ``Backlog``
   ↳ Expected state: Issue in backlog

4. ``Backlog`` → to triage → ``PM_Triage``
   ↳ Expected state: Awaiting PM review

5. ``PM_Triage`` → approve and assign → ``Assigned_Lane`` → ``On_Deck``
   ↳ Expected state: Label **on deck** applied; label **on the bench** removed

6. ``On_Deck`` → rebalance trigger → ``Rebalance_Deck`` → ``At_Bat``
   ↳ Expected state: Label **on deck** removed; label **at bat** applied

7. ``At_Bat`` → verify AC → ``AC_Check`` → AC ready → ``Dev_Assigned``
   ↳ Expected state: Label **implementation ready** applied; developer assigned

8. ``Dev_Assigned`` → manual close without PR → ``Manual_Close_Check`` → ``Manual_Completed`` → ``[*]``
   ↳ Expected state: Issue closed as **completed** without a merged PR

---

## Labels

- Step 5: label ``on deck`` applied; label ``on the bench`` removed
- Step 6: label ``on deck`` removed; label ``at bat`` applied
- Step 7: label ``implementation ready`` applied

---

## Exit

**Exit state:** Manually_Completed
**Close reason:** completed (no PR)

---

- [ ] Path followed correctly
"@
New-PathIssue 4 "[Workflow Path Test] Manually_Completed via On_Deck" $body

# ─── PATH 5 ───────────────────────────────────────────────────────────────────
$body = @"
## Path 5 of 26 | Exit: Manually_Completed

**Lane:** In_The_Hole → On_Deck → At_Bat

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → issue submitted → ``Auto_Validation``
   ↳ Expected state: Validation gate running

3. ``Auto_Validation`` → validation passes → ``Backlog``
   ↳ Expected state: Issue in backlog

4. ``Backlog`` → to triage → ``PM_Triage``
   ↳ Expected state: Awaiting PM review

5. ``PM_Triage`` → approve and assign → ``Assigned_Lane`` → ``In_Hole``
   ↳ Expected state: Label **in the hole** applied; label **on the bench** removed

6. ``In_Hole`` → rebalance trigger → ``Rebalance_Hole`` → ``On_Deck``
   ↳ Expected state: Label **in the hole** removed; label **on deck** applied

7. ``On_Deck`` → rebalance trigger → ``Rebalance_Deck`` → ``At_Bat``
   ↳ Expected state: Label **on deck** removed; label **at bat** applied

8. ``At_Bat`` → verify AC → ``AC_Check`` → AC ready → ``Dev_Assigned``
   ↳ Expected state: Label **implementation ready** applied; developer assigned

9. ``Dev_Assigned`` → manual close without PR → ``Manual_Close_Check`` → ``Manual_Completed`` → ``[*]``
   ↳ Expected state: Issue closed as **completed** without a merged PR

---

## Labels

- Step 5: label ``in the hole`` applied; label ``on the bench`` removed
- Step 6: label ``in the hole`` removed; label ``on deck`` applied
- Step 7: label ``on deck`` removed; label ``at bat`` applied
- Step 8: label ``implementation ready`` applied

---

## Exit

**Exit state:** Manually_Completed
**Close reason:** completed (no PR)

---

- [ ] Path followed correctly
"@
New-PathIssue 5 "[Workflow Path Test] Manually_Completed via In_The_Hole" $body

# ─── PATH 6 ───────────────────────────────────────────────────────────────────
$body = @"
## Path 6 of 26 | Exit: Manually_Completed

**Lane:** On_The_Bench → In_The_Hole → On_Deck → At_Bat

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → issue submitted → ``Auto_Validation``
   ↳ Expected state: Validation gate running

3. ``Auto_Validation`` → validation passes → ``Backlog``
   ↳ Expected state: Issue in backlog

4. ``Backlog`` → to triage → ``PM_Triage``
   ↳ Expected state: Awaiting PM review

5. ``PM_Triage`` → approve and assign → ``Assigned_Lane`` → ``On_Bench``
   ↳ Expected state: Label **on the bench** already applied (default)

6. ``On_Bench`` → rebalance trigger → ``Rebalance_Bench`` → ``In_Hole``
   ↳ Expected state: Label **on the bench** removed; label **in the hole** applied

7. ``In_Hole`` → rebalance trigger → ``Rebalance_Hole`` → ``On_Deck``
   ↳ Expected state: Label **in the hole** removed; label **on deck** applied

8. ``On_Deck`` → rebalance trigger → ``Rebalance_Deck`` → ``At_Bat``
   ↳ Expected state: Label **on deck** removed; label **at bat** applied

9. ``At_Bat`` → verify AC → ``AC_Check`` → AC ready → ``Dev_Assigned``
   ↳ Expected state: Label **implementation ready** applied; developer assigned

10. ``Dev_Assigned`` → manual close without PR → ``Manual_Close_Check`` → ``Manual_Completed`` → ``[*]``
    ↳ Expected state: Issue closed as **completed** without a merged PR

---

## Labels

- Step 5: label ``on the bench`` applied (default lane)
- Step 6: label ``on the bench`` removed; label ``in the hole`` applied
- Step 7: label ``in the hole`` removed; label ``on deck`` applied
- Step 8: label ``on deck`` removed; label ``at bat`` applied
- Step 9: label ``implementation ready`` applied

---

## Exit

**Exit state:** Manually_Completed
**Close reason:** completed (no PR)

---

- [ ] Path followed correctly
"@
New-PathIssue 6 "[Workflow Path Test] Manually_Completed via On_The_Bench" $body

# ─── HELPER: MERGE SUFFIX ─────────────────────────────────────────────────────
# Used by paths 7-22; caller provides the step offset and AI outcome steps

function Get-MergeSuffix {
  param($offset)
  $n = $offset
  return @"

$($n). ``Stage_3_Acceptance`` → verify → ``AC_Check`` → criteria met → ``Stage_4_CI_CD``
    ↳ Expected state: Acceptance criteria satisfied; CI/CD pipeline starting

$($n+1). ``Stage_4_CI_CD`` → run tests → ``CI_Check`` → tests pass → ``Stage_5_Human``
    ↳ Expected state: All CI/CD checks green; awaiting human approval

$($n+2). ``Stage_5_Human`` → begin review → ``Maintainer_Review`` → approve → ``Stage_6_Merge``
    ↳ Expected state: Maintainer approved PR; merge authorized

$($n+3). ``Stage_6_Merge`` → merge → ``Auto_Merge`` → merged → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
    ↳ Expected state: PR merged to main; issue closed as **completed**
"@
}

# ─── HELPER: PR + STAGE1 steps (same for all merge/escalation paths) ──────────
function Get-PRSteps {
  param($startN, $laneName)
  $n = $startN
  return @"
$($n). ``At_Bat`` → verify AC → ``AC_Check`` → AC ready → ``Dev_Assigned``
    ↳ Expected state: Label **implementation ready** applied; developer assigned

$($n+1). ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
    ↳ Expected state: Development in progress on feature branch

$($n+2). ``Dev_In_Progress`` → open PR → ``PR_Created``
    ↳ Expected state: Pull request open; format check pending

$($n+3). ``PR_Created`` → validate format → ``Stage_1_PR_Format`` → format valid → ``Stage_2_AI_Review``
    ↳ Expected state: PR format valid; AI code review starting
"@
}

# ─── PATH 7: Merged / At_Bat Direct / AI R1 Pass ─────────────────────────────
$body = @"
## Path 7 of 26 | Exit: Merged (Close_Issue)

**Lane:** At_Bat Direct
**AI Outcome:** Round 1 Pass

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``At_Bat``
   ↳ Expected state: Label **at bat** applied; label **on the bench** removed

4. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

5. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

6. ``Stage_2_AI_Review`` → begin → ``Review_R1`` → evaluate → ``Check_R1`` → no issues → ``AI_Approved_R1``
   ↳ Expected state: AI Round 1 review passed on first attempt

7. ``AI_Approved_R1`` → proceed → ``Stage_3_Acceptance`` → criteria met → ``Stage_4_CI_CD``
   ↳ Expected state: Acceptance criteria satisfied; CI/CD running

8. ``Stage_4_CI_CD`` → tests pass → ``Stage_5_Human`` → maintainer approves → ``Stage_6_Merge``
   ↳ Expected state: Human approved; merge authorized

9. ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
   ↳ Expected state: PR merged to main; issue closed as **completed**

---

## Labels

- Step 3: label ``at bat`` applied; label ``on the bench`` removed
- Step 4: label ``implementation ready`` applied

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
New-PathIssue 7 "[Workflow Path Test] Merged via At_Bat Direct, AI Round 1 Pass" $body

# ─── PATH 8: Merged / At_Bat Direct / AI R2 Pass ─────────────────────────────
$body = @"
## Path 8 of 26 | Exit: Merged (Close_Issue)

**Lane:** At_Bat Direct
**AI Outcome:** Round 2 Pass (Round 1 fails, auto-fix applied)

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``At_Bat``
   ↳ Expected state: Label **at bat** applied; label **on the bench** removed

4. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

5. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

6. ``Stage_2_AI_Review`` → ``Review_R1`` → ``Check_R1`` → issues found → ``AI_Comments_R1``
   ↳ Expected state: AI Round 1 found issues; auto-fix triggered

7. ``AI_Comments_R1`` → auto fix → ``Auto_Fix_Attempt`` → re-review → ``Re_Review_R1`` → ``Check_R2`` → no issues → ``AI_Approved_R2``
   ↳ Expected state: Auto-fix applied; AI Round 2 passed

8. ``AI_Approved_R2`` → proceed → ``Stage_3_Acceptance`` → criteria met → ``Stage_4_CI_CD``
   ↳ Expected state: Acceptance criteria satisfied; CI/CD running

9. ``Stage_4_CI_CD`` → tests pass → ``Stage_5_Human`` → maintainer approves → ``Stage_6_Merge``
   ↳ Expected state: Human approved; merge authorized

10. ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
    ↳ Expected state: PR merged to main; issue closed as **completed**

---

## Labels

- Step 3: label ``at bat`` applied; label ``on the bench`` removed
- Step 4: label ``implementation ready`` applied

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
New-PathIssue 8 "[Workflow Path Test] Merged via At_Bat Direct, AI Round 2 Pass" $body

# ─── PATH 9: Merged / At_Bat Direct / AI R3 Pass ─────────────────────────────
$body = @"
## Path 9 of 26 | Exit: Merged (Close_Issue)

**Lane:** At_Bat Direct
**AI Outcome:** Round 3 Pass (Rounds 1 and 2 fail, two auto-fixes applied)

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``At_Bat``
   ↳ Expected state: Label **at bat** applied; label **on the bench** removed

4. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

5. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

6. ``Stage_2_AI_Review`` → ``Review_R1`` → ``Check_R1`` → issues found → ``AI_Comments_R1`` → ``Auto_Fix_Attempt``
   ↳ Expected state: AI Round 1 issues found; first auto-fix applied

7. ``Auto_Fix_Attempt`` → re-review → ``Re_Review_R1`` → ``Check_R2`` → issues found → ``AI_Comments_R2`` → ``Auto_Fix_Attempt_2``
   ↳ Expected state: AI Round 2 issues found; second auto-fix applied

8. ``Auto_Fix_Attempt_2`` → re-review → ``Re_Review_R2`` → ``Check_R3`` → no issues → ``AI_Approved_R3``
   ↳ Expected state: AI Round 3 passed; all issues resolved

9. ``AI_Approved_R3`` → proceed → ``Stage_3_Acceptance`` → criteria met → ``Stage_4_CI_CD``
   ↳ Expected state: Acceptance criteria satisfied; CI/CD running

10. ``Stage_4_CI_CD`` → tests pass → ``Stage_5_Human`` → maintainer approves → ``Stage_6_Merge``
    ↳ Expected state: Human approved; merge authorized

11. ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
    ↳ Expected state: PR merged to main; issue closed as **completed**

---

## Labels

- Step 3: label ``at bat`` applied; label ``on the bench`` removed
- Step 4: label ``implementation ready`` applied

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
New-PathIssue 9 "[Workflow Path Test] Merged via At_Bat Direct, AI Round 3 Pass" $body

# ─── PATH 10: Merged / At_Bat Direct / AI Escalated then Approved ─────────────
$body = @"
## Path 10 of 26 | Exit: Merged (Close_Issue)

**Lane:** At_Bat Direct
**AI Outcome:** All 3 rounds fail → escalated to maintainer → maintainer approves

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``At_Bat``
   ↳ Expected state: Label **at bat** applied; label **on the bench** removed

4. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

5. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

6. ``Stage_2_AI_Review`` → ``Review_R1`` → issues found → ``Auto_Fix_Attempt`` → ``Re_Review_R1`` → issues found → ``Auto_Fix_Attempt_2`` → ``Re_Review_R2`` → issues remain → ``AI_Comments_R3``
   ↳ Expected state: All 3 AI review rounds failed; escalation triggered

7. ``AI_Comments_R3`` → escalate → ``Escalation_Decision`` → ``Auto_Assign_Maintainer``
   ↳ Expected state: Issue assigned to maintainer for escalated review

8. ``Auto_Assign_Maintainer`` → escalated review → ``Stage_5_Escalated`` → ``Maintainer_Review_Esc`` → ``Review_Decision_Esc`` → approve → ``Stage_6_Merge``
   ↳ Expected state: Maintainer reviewed escalation and approved; merge authorized

9. ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
   ↳ Expected state: PR merged to main; issue closed as **completed**

---

## Labels

- Step 3: label ``at bat`` applied; label ``on the bench`` removed
- Step 4: label ``implementation ready`` applied

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
New-PathIssue 10 "[Workflow Path Test] Merged via At_Bat Direct, AI Escalated then Approved" $body

# ─── PATHS 11-14: Merged via On_Deck × 4 AI outcomes ─────────────────────────

$laneStepsOnDeck = @"
3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``On_Deck``
   ↳ Expected state: Label **on deck** applied; label **on the bench** removed

4. ``On_Deck`` → rebalance trigger → ``Rebalance_Deck`` → ``At_Bat``
   ↳ Expected state: Label **on deck** removed; label **at bat** applied

"@

$laneLabelsOnDeck = @"
- Step 3: label ``on deck`` applied; label ``on the bench`` removed
- Step 4: label ``on deck`` removed; label ``at bat`` applied
- Step 5: label ``implementation ready`` applied
"@

$body = @"
## Path 11 of 26 | Exit: Merged (Close_Issue)

**Lane:** On_Deck → rebalance → At_Bat
**AI Outcome:** Round 1 Pass

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

$laneStepsOnDeck
5. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

6. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI Round 1 review starting

7. ``Stage_2_AI_Review`` → ``Review_R1`` → ``Check_R1`` → no issues → ``AI_Approved_R1``
   ↳ Expected state: AI Round 1 passed on first attempt

8. ``AI_Approved_R1`` → ``Stage_3_Acceptance`` → criteria met → ``Stage_4_CI_CD`` → tests pass → ``Stage_5_Human`` → approve → ``Stage_6_Merge``
   ↳ Expected state: All gates passed; merge authorized

9. ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
   ↳ Expected state: PR merged to main; issue closed as **completed**

---

## Labels

$laneLabelsOnDeck

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
New-PathIssue 11 "[Workflow Path Test] Merged via On_Deck, AI Round 1 Pass" $body

$body = @"
## Path 12 of 26 | Exit: Merged (Close_Issue)

**Lane:** On_Deck → rebalance → At_Bat
**AI Outcome:** Round 2 Pass (Round 1 fails, auto-fix applied)

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

$laneStepsOnDeck
5. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

6. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

7. ``Stage_2_AI_Review`` → ``Review_R1`` → issues found → ``Auto_Fix_Attempt`` → ``Re_Review_R1`` → ``Check_R2`` → no issues → ``AI_Approved_R2``
   ↳ Expected state: Round 1 failed, auto-fix applied, Round 2 passed

8. ``AI_Approved_R2`` → ``Stage_3_Acceptance`` → criteria met → ``Stage_4_CI_CD`` → tests pass → ``Stage_5_Human`` → approve → ``Stage_6_Merge``
   ↳ Expected state: All gates passed; merge authorized

9. ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
   ↳ Expected state: PR merged to main; issue closed as **completed**

---

## Labels

$laneLabelsOnDeck

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
New-PathIssue 12 "[Workflow Path Test] Merged via On_Deck, AI Round 2 Pass" $body

$body = @"
## Path 13 of 26 | Exit: Merged (Close_Issue)

**Lane:** On_Deck → rebalance → At_Bat
**AI Outcome:** Round 3 Pass (Rounds 1 and 2 fail, two auto-fixes applied)

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

$laneStepsOnDeck
5. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

6. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

7. ``Stage_2_AI_Review`` → R1 fail → ``Auto_Fix_Attempt`` → R2 fail → ``Auto_Fix_Attempt_2`` → ``Re_Review_R2`` → ``Check_R3`` → no issues → ``AI_Approved_R3``
   ↳ Expected state: Rounds 1 and 2 failed; two auto-fixes applied; Round 3 passed

8. ``AI_Approved_R3`` → ``Stage_3_Acceptance`` → criteria met → ``Stage_4_CI_CD`` → tests pass → ``Stage_5_Human`` → approve → ``Stage_6_Merge``
   ↳ Expected state: All gates passed; merge authorized

9. ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
   ↳ Expected state: PR merged to main; issue closed as **completed**

---

## Labels

$laneLabelsOnDeck

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
New-PathIssue 13 "[Workflow Path Test] Merged via On_Deck, AI Round 3 Pass" $body

$body = @"
## Path 14 of 26 | Exit: Merged (Close_Issue)

**Lane:** On_Deck → rebalance → At_Bat
**AI Outcome:** All 3 rounds fail → escalated to maintainer → maintainer approves

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

$laneStepsOnDeck
5. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

6. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

7. ``Stage_2_AI_Review`` → R1 fail → ``Auto_Fix_Attempt`` → R2 fail → ``Auto_Fix_Attempt_2`` → R3 fail → ``AI_Comments_R3`` → ``Escalation_Decision`` → ``Auto_Assign_Maintainer``
   ↳ Expected state: All 3 AI rounds failed; maintainer assigned for escalated review

8. ``Auto_Assign_Maintainer`` → ``Stage_5_Escalated`` → ``Maintainer_Review_Esc`` → ``Review_Decision_Esc`` → approve → ``Stage_6_Merge``
   ↳ Expected state: Maintainer approved escalation; merge authorized

9. ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
   ↳ Expected state: PR merged to main; issue closed as **completed**

---

## Labels

$laneLabelsOnDeck

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
New-PathIssue 14 "[Workflow Path Test] Merged via On_Deck, AI Escalated then Approved" $body

# ─── PATHS 15-18: Merged via In_The_Hole × 4 AI outcomes ─────────────────────

$laneStepsInHole = @"
3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``In_Hole``
   ↳ Expected state: Label **in the hole** applied; label **on the bench** removed

4. ``In_Hole`` → rebalance trigger → ``Rebalance_Hole`` → ``On_Deck``
   ↳ Expected state: Label **in the hole** removed; label **on deck** applied

5. ``On_Deck`` → rebalance trigger → ``Rebalance_Deck`` → ``At_Bat``
   ↳ Expected state: Label **on deck** removed; label **at bat** applied

"@

$laneLabelsInHole = @"
- Step 3: label ``in the hole`` applied; label ``on the bench`` removed
- Step 4: label ``in the hole`` removed; label ``on deck`` applied
- Step 5: label ``on deck`` removed; label ``at bat`` applied
- Step 6: label ``implementation ready`` applied
"@

foreach ($aiOutcome in @(
    @{num = 15; outcome = "AI Round 1 Pass"; aiSteps = "``Stage_2_AI_Review`` → ``Review_R1`` → ``Check_R1`` → no issues → ``AI_Approved_R1``\n   ↳ Expected state: AI Round 1 passed on first attempt"; approvedState = "AI_Approved_R1" },
    @{num = 16; outcome = "AI Round 2 Pass"; aiSteps = "``Stage_2_AI_Review`` → R1 fail → ``Auto_Fix_Attempt`` → ``Re_Review_R1`` → ``Check_R2`` → no issues → ``AI_Approved_R2``\n   ↳ Expected state: Round 1 failed, auto-fix applied, Round 2 passed"; approvedState = "AI_Approved_R2" },
    @{num = 17; outcome = "AI Round 3 Pass"; aiSteps = "``Stage_2_AI_Review`` → R1 fail → ``Auto_Fix_Attempt`` → R2 fail → ``Auto_Fix_Attempt_2`` → ``Check_R3`` → no issues → ``AI_Approved_R3``\n   ↳ Expected state: Rounds 1 and 2 failed; two auto-fixes; Round 3 passed"; approvedState = "AI_Approved_R3" },
    @{num = 18; outcome = "AI Escalated then Approved"; aiSteps = "``Stage_2_AI_Review`` → R1/R2/R3 all fail → ``Escalation_Decision`` → ``Auto_Assign_Maintainer`` → ``Stage_5_Escalated`` → ``Maintainer_Review_Esc`` → approve → ``Stage_6_Merge``\n   ↳ Expected state: All AI rounds failed; maintainer escalation approved"; approvedState = "Stage_6_Merge" }
  )) {
  $n = $aiOutcome.num
  $laneTitle = "In_The_Hole"
  $aiS = $aiOutcome.aiSteps -replace '\\n', "`n"
  $mergeStep = if ($aiOutcome.approvedState -eq "Stage_6_Merge") {
    ""
  }
  else {
    "`n$($n+7). ``$($aiOutcome.approvedState)`` → ``Stage_3_Acceptance`` → criteria met → ``Stage_4_CI_CD`` → tests pass → ``Stage_5_Human`` → approve → ``Stage_6_Merge``
    ↳ Expected state: All gates passed; merge authorized`n"
  }

  $body = @"
## Path $n of 26 | Exit: Merged (Close_Issue)

**Lane:** In_The_Hole → On_Deck → At_Bat
**AI Outcome:** $($aiOutcome.outcome)

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

$laneStepsInHole
6. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

7. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

8. $aiS
$mergeStep
$(if ($aiOutcome.approvedState -ne "Stage_6_Merge") { "$($n+8). ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
    ↳ Expected state: PR merged to main; issue closed as **completed**" } else { "$(($n+8)). ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
    ↳ Expected state: PR merged to main; issue closed as **completed**" })

---

## Labels

$laneLabelsInHole

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
  New-PathIssue $n "[Workflow Path Test] Merged via In_The_Hole, $($aiOutcome.outcome)" $body
}

# ─── PATHS 19-22: Merged via On_The_Bench × 4 AI outcomes ─────────────────────

$laneStepsOnBench = @"
3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``On_Bench``
   ↳ Expected state: Label **on the bench** applied (default lane)

4. ``On_Bench`` → rebalance trigger → ``Rebalance_Bench`` → ``In_Hole``
   ↳ Expected state: Label **on the bench** removed; label **in the hole** applied

5. ``In_Hole`` → rebalance trigger → ``Rebalance_Hole`` → ``On_Deck``
   ↳ Expected state: Label **in the hole** removed; label **on deck** applied

6. ``On_Deck`` → rebalance trigger → ``Rebalance_Deck`` → ``At_Bat``
   ↳ Expected state: Label **on deck** removed; label **at bat** applied

"@

$laneLabelsOnBench = @"
- Step 3: label ``on the bench`` applied (default lane)
- Step 4: label ``on the bench`` removed; label ``in the hole`` applied
- Step 5: label ``in the hole`` removed; label ``on deck`` applied
- Step 6: label ``on deck`` removed; label ``at bat`` applied
- Step 7: label ``implementation ready`` applied
"@

foreach ($aiOutcome in @(
    @{num = 19; outcome = "AI Round 1 Pass"; aiSteps = "``Stage_2_AI_Review`` → ``Review_R1`` → ``Check_R1`` → no issues → ``AI_Approved_R1``\n   ↳ Expected state: AI Round 1 passed on first attempt"; approvedState = "AI_Approved_R1" },
    @{num = 20; outcome = "AI Round 2 Pass"; aiSteps = "``Stage_2_AI_Review`` → R1 fail → ``Auto_Fix_Attempt`` → ``Re_Review_R1`` → ``Check_R2`` → no issues → ``AI_Approved_R2``\n   ↳ Expected state: Round 1 failed, auto-fix applied, Round 2 passed"; approvedState = "AI_Approved_R2" },
    @{num = 21; outcome = "AI Round 3 Pass"; aiSteps = "``Stage_2_AI_Review`` → R1 fail → ``Auto_Fix_Attempt`` → R2 fail → ``Auto_Fix_Attempt_2`` → ``Check_R3`` → no issues → ``AI_Approved_R3``\n   ↳ Expected state: Rounds 1 and 2 failed; two auto-fixes; Round 3 passed"; approvedState = "AI_Approved_R3" },
    @{num = 22; outcome = "AI Escalated then Approved"; aiSteps = "``Stage_2_AI_Review`` → R1/R2/R3 all fail → ``Escalation_Decision`` → ``Auto_Assign_Maintainer`` → ``Stage_5_Escalated`` → ``Maintainer_Review_Esc`` → approve → ``Stage_6_Merge``\n   ↳ Expected state: All AI rounds failed; maintainer escalation approved"; approvedState = "Stage_6_Merge" }
  )) {
  $n = $aiOutcome.num
  $aiS = $aiOutcome.aiSteps -replace '\\n', "`n"
  $mergeStep = if ($aiOutcome.approvedState -eq "Stage_6_Merge") { "" } else {
    "`n$(($n+8)). ``$($aiOutcome.approvedState)`` → ``Stage_3_Acceptance`` → criteria met → ``Stage_4_CI_CD`` → tests pass → ``Stage_5_Human`` → approve → ``Stage_6_Merge``
    ↳ Expected state: All gates passed; merge authorized`n"
  }

  $body = @"
## Path $n of 26 | Exit: Merged (Close_Issue)

**Lane:** On_The_Bench → In_The_Hole → On_Deck → At_Bat
**AI Outcome:** $($aiOutcome.outcome)

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

$laneStepsOnBench
7. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

8. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

9. $aiS
$mergeStep
$(if ($aiOutcome.approvedState -ne "Stage_6_Merge") { "$(($n+9)). ``Stage_6_Merge`` → ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
    ↳ Expected state: PR merged to main; issue closed as **completed**" } else { "$(($n+9)). ``Auto_Merge`` → ``Merged_Success`` → ``Issue_Complete`` → ``Close_Issue`` → ``[*]``
    ↳ Expected state: PR merged to main; issue closed as **completed**" })

---

## Labels

$laneLabelsOnBench

---

## Exit

**Exit state:** Close_Issue (merged)
**Close reason:** completed

---

- [ ] Path followed correctly
"@
  New-PathIssue $n "[Workflow Path Test] Merged via On_The_Bench, $($aiOutcome.outcome)" $body
}

# ─── PATHS 23-26: Closed_Escalation_Rejected × 4 lanes ───────────────────────

$escCommonSteps = @"
AI review steps: ``Stage_2_AI_Review`` → R1 fail → ``Auto_Fix_Attempt`` → R2 fail → ``Auto_Fix_Attempt_2`` → R3 fail → ``AI_Comments_R3``
   ↳ Expected state: All 3 AI review rounds failed; escalation triggered

Next: ``AI_Comments_R3`` → ``Escalation_Decision`` → ``Auto_Assign_Maintainer`` → ``Stage_5_Escalated`` → ``Maintainer_Review_Esc`` → ``Review_Decision_Esc`` → **reject** → ``Approval_Rejected_Esc``
   ↳ Expected state: Maintainer rejected the escalated PR

Final: ``Approval_Rejected_Esc`` → ``PR_Closed_Rejected`` → ``Closed_Failed`` → ``[*]``
   ↳ Expected state: PR closed; issue closed as **not planned** (design rejected)
"@

# Path 23: At_Bat Direct
$body = @"
## Path 23 of 26 | Exit: Closed_Escalation_Rejected (Closed_Failed)

**Lane:** At_Bat Direct
**AI Outcome:** All 3 rounds fail → escalated → maintainer rejects

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``At_Bat``
   ↳ Expected state: Label **at bat** applied; label **on the bench** removed

4. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

5. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

6. $escCommonSteps

---

## Labels

- Step 3: label ``at bat`` applied; label ``on the bench`` removed
- Step 4: label ``implementation ready`` applied

---

## Exit

**Exit state:** Closed_Failed (Closed_Escalation_Rejected)
**Close reason:** not planned (design rejected by maintainer)

---

- [ ] Path followed correctly
"@
New-PathIssue 23 "[Workflow Path Test] Closed_Escalation_Rejected via At_Bat Direct" $body

# Path 24: On_Deck
$body = @"
## Path 24 of 26 | Exit: Closed_Escalation_Rejected (Closed_Failed)

**Lane:** On_Deck → rebalance → At_Bat
**AI Outcome:** All 3 rounds fail → escalated → maintainer rejects

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``On_Deck``
   ↳ Expected state: Label **on deck** applied; label **on the bench** removed

4. ``On_Deck`` → rebalance trigger → ``Rebalance_Deck`` → ``At_Bat``
   ↳ Expected state: Label **on deck** removed; label **at bat** applied

5. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

6. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

7. $escCommonSteps

---

## Labels

- Step 3: label ``on deck`` applied; label ``on the bench`` removed
- Step 4: label ``on deck`` removed; label ``at bat`` applied
- Step 5: label ``implementation ready`` applied

---

## Exit

**Exit state:** Closed_Failed (Closed_Escalation_Rejected)
**Close reason:** not planned (design rejected by maintainer)

---

- [ ] Path followed correctly
"@
New-PathIssue 24 "[Workflow Path Test] Closed_Escalation_Rejected via On_Deck" $body

# Path 25: In_The_Hole
$body = @"
## Path 25 of 26 | Exit: Closed_Escalation_Rejected (Closed_Failed)

**Lane:** In_The_Hole → On_Deck → At_Bat
**AI Outcome:** All 3 rounds fail → escalated → maintainer rejects

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``In_Hole``
   ↳ Expected state: Label **in the hole** applied; label **on the bench** removed

4. ``In_Hole`` → rebalance trigger → ``Rebalance_Hole`` → ``On_Deck``
   ↳ Expected state: Label **in the hole** removed; label **on deck** applied

5. ``On_Deck`` → rebalance trigger → ``Rebalance_Deck`` → ``At_Bat``
   ↳ Expected state: Label **on deck** removed; label **at bat** applied

6. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

7. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

8. $escCommonSteps

---

## Labels

- Step 3: label ``in the hole`` applied; label ``on the bench`` removed
- Step 4: label ``in the hole`` removed; label ``on deck`` applied
- Step 5: label ``on deck`` removed; label ``at bat`` applied
- Step 6: label ``implementation ready`` applied

---

## Exit

**Exit state:** Closed_Failed (Closed_Escalation_Rejected)
**Close reason:** not planned (design rejected by maintainer)

---

- [ ] Path followed correctly
"@
New-PathIssue 25 "[Workflow Path Test] Closed_Escalation_Rejected via In_The_Hole" $body

# Path 26: On_The_Bench
$body = @"
## Path 26 of 26 | Exit: Closed_Escalation_Rejected (Closed_Failed)

**Lane:** On_The_Bench → In_The_Hole → On_Deck → At_Bat
**AI Outcome:** All 3 rounds fail → escalated → maintainer rejects

---

## Steps

1. ``[*]`` → user creates issue → ``Issue_Created``
   ↳ Expected state: Issue open, no labels applied

2. ``Issue_Created`` → submitted → ``Auto_Validation`` → passes → ``Backlog``
   ↳ Expected state: Issue in backlog

3. ``Backlog`` → PM approves → ``Assigned_Lane`` → ``On_Bench``
   ↳ Expected state: Label **on the bench** applied (default lane)

4. ``On_Bench`` → rebalance trigger → ``Rebalance_Bench`` → ``In_Hole``
   ↳ Expected state: Label **on the bench** removed; label **in the hole** applied

5. ``In_Hole`` → rebalance trigger → ``Rebalance_Hole`` → ``On_Deck``
   ↳ Expected state: Label **in the hole** removed; label **on deck** applied

6. ``On_Deck`` → rebalance trigger → ``Rebalance_Deck`` → ``At_Bat``
   ↳ Expected state: Label **on deck** removed; label **at bat** applied

7. ``At_Bat`` → AC check passes → ``Dev_Assigned`` → create branch → ``Dev_In_Progress``
   ↳ Expected state: Label **implementation ready** applied; development in progress

8. ``Dev_In_Progress`` → open PR → ``PR_Created`` → format valid → ``Stage_2_AI_Review``
   ↳ Expected state: PR open; AI code review starting

9. $escCommonSteps

---

## Labels

- Step 3: label ``on the bench`` applied (default lane)
- Step 4: label ``on the bench`` removed; label ``in the hole`` applied
- Step 5: label ``in the hole`` removed; label ``on deck`` applied
- Step 6: label ``on deck`` removed; label ``at bat`` applied
- Step 7: label ``implementation ready`` applied

---

## Exit

**Exit state:** Closed_Failed (Closed_Escalation_Rejected)
**Close reason:** not planned (design rejected by maintainer)

---

- [ ] Path followed correctly
"@
New-PathIssue 26 "[Workflow Path Test] Closed_Escalation_Rejected via On_The_Bench" $body

# ─── SUMMARY ──────────────────────────────────────────────────────────────────
Write-Host "`n=== SUMMARY TABLE ===`n"
Write-Host "Path | Issue | Exit State | URL"
Write-Host "-----|-------|------------|----"
foreach ($r in $results) {
  Write-Host "$($r.Path) | #$($r.Issue) | $($r.Exit) | $($r.URL)"
}

$results | Export-Csv -Path "automation-results/workflow-path-issues.csv" -NoTypeInformation
Write-Host "`nSaved to automation-results/workflow-path-issues.csv"
