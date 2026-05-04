// scripts/drive-path-test.js
//
// Drives every workflow-path-test issue through the path defined in its body,
// verifies the state after each step, closes the issue with the expected close
// reason, and posts a comment to the issue for any verification failure.
//
// Environment variables:
//   GITHUB_TOKEN / TOKEN   — GitHub token with issues:write scope
//   GITHUB_REPOSITORY      — "owner/repo" (defaults to hardcoded repo)
//   ISSUE_NUMBERS          — optional comma-separated list to restrict which
//                            issues are driven (e.g. "185,186,187")
//   DRY_RUN                — "true" to parse and log without writing anything

"use strict";

const fetch = require("node-fetch");

const TOKEN = process.env.GITHUB_TOKEN || process.env.TOKEN;
const REPO =
  process.env.GITHUB_REPOSITORY ||
  "JohnMichaelMiller/ai-practitioner-resources";
const [OWNER, REPO_NAME] = REPO.split("/");
const API = process.env.GITHUB_API_URL || "https://api.github.com";
const DRY_RUN = process.env.DRY_RUN === "true";
const ISSUE_FILTER = process.env.ISSUE_NUMBERS
  ? process.env.ISSUE_NUMBERS.split(",").map((s) => parseInt(s.trim(), 10))
  : null;

// ─── GitHub REST helpers ──────────────────────────────────────────────────────

function baseHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function ghGet(path) {
  const res = await fetch(`${API}${path}`, { headers: baseHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path}: ${res.status} — ${text}`);
  }
  return res.json();
}

async function ghPost(path, body) {
  if (DRY_RUN) {
    console.log(`  [DRY] POST ${path}`, JSON.stringify(body).slice(0, 120));
    return {};
  }
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path}: ${res.status} — ${text}`);
  }
  return res.json();
}

async function ghPatch(path, body) {
  if (DRY_RUN) {
    console.log(`  [DRY] PATCH ${path}`, JSON.stringify(body).slice(0, 120));
    return {};
  }
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path}: ${res.status} — ${text}`);
  }
  return res.json();
}

async function ghDelete(path) {
  if (DRY_RUN) {
    console.log(`  [DRY] DELETE ${path}`);
    return;
  }
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: baseHeaders(),
  });
  // 404 = label not on issue, safe to ignore
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`DELETE ${path}: ${res.status} — ${text}`);
  }
}

// ─── Issue operations ─────────────────────────────────────────────────────────

function issuePath(number) {
  return `/repos/${OWNER}/${REPO_NAME}/issues/${number}`;
}

async function getIssue(number) {
  return ghGet(issuePath(number));
}

async function addLabels(number, labels) {
  if (!labels.length) return;
  await ghPost(`${issuePath(number)}/labels`, { labels });
}

async function removeLabel(number, label) {
  await ghDelete(`${issuePath(number)}/labels/${encodeURIComponent(label)}`);
}

async function setIssueState(number, state, stateReason) {
  const body = { state };
  if (stateReason) body.state_reason = stateReason;
  await ghPatch(issuePath(number), body);
}

async function updateBody(number, body) {
  await ghPatch(issuePath(number), { body });
}

async function postComment(number, markdown) {
  await ghPost(`${issuePath(number)}/comments`, { body: markdown });
}

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Issue bodies use "---" as section separators. Split on that and locate
// the ## Labels and ## Exit sections.

function parseSections(body) {
  // Normalise line endings, then split on horizontal rules
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n---\n/)
    .map((s) => s.trim());
}

function findSection(sections, heading) {
  return sections.find((s) => s.startsWith(`## ${heading}`)) || "";
}

/**
 * Parse the ## Labels section into an array of step descriptors:
 *   [ { step: N, add: [string], remove: [string] }, ... ]
 *
 * Handles lines like:
 *   - Step 4: label `needs-details` applied
 *   - Step 5: label `at bat` applied; label `on the bench` removed
 *   - Step 5: label `on the bench` applied (default lane)
 *   - No lane labels applied ...   ← produces no entries
 */
function parseLabelSteps(body) {
  const sections = parseSections(body);
  const labelsSection = findSection(sections, "Labels");
  const steps = [];

  for (const line of labelsSection.split("\n")) {
    const m = line.match(/^\s*-\s+Step\s+(\d+):\s+(.+)$/i);
    if (!m) continue;

    const stepNum = parseInt(m[1], 10);
    const desc = m[2];
    const add = [];
    const remove = [];

    for (const am of desc.matchAll(/label\s+`([^`]+)`\s+applied/gi)) {
      add.push(am[1]);
    }
    for (const rm of desc.matchAll(/label\s+`([^`]+)`\s+removed/gi)) {
      remove.push(rm[1]);
    }

    if (add.length || remove.length) {
      steps.push({ step: stepNum, add, remove });
    }
  }

  return steps;
}

/**
 * Parse the ## Exit section:
 *   { exitState: string, stateReason: "completed" | "not_planned" }
 *
 * "Close reason: not planned..." → "not_planned"
 * anything else                  → "completed"
 */
function parseExit(body) {
  const sections = parseSections(body);
  const exitSection = findSection(sections, "Exit");

  const stateMatch = exitSection.match(/\*\*Exit state:\*\*\s*(.+)/);
  const reasonMatch = exitSection.match(/\*\*Close reason:\*\*\s*(.+)/);

  const exitState = stateMatch ? stateMatch[1].trim() : "unknown";
  const reasonText = reasonMatch
    ? reasonMatch[1].trim().toLowerCase()
    : "completed";
  const stateReason = reasonText.startsWith("not planned")
    ? "not_planned"
    : "completed";

  return { exitState, stateReason };
}

// ─── Reset ────────────────────────────────────────────────────────────────────
// Strip all labels except workflow-path-test, restore "on the bench",
// and re-open the issue if it was closed.

const PROTECTED_LABELS = new Set(["workflow-path-test"]);

async function resetIssue(number) {
  const issue = await getIssue(number);

  if (issue.state === "closed") {
    await setIssueState(number, "open", null);
    console.log(`  Reopened #${number}`);
  }

  const currentLabels = issue.labels.map((l) => l.name);
  for (const label of currentLabels) {
    if (!PROTECTED_LABELS.has(label)) {
      await removeLabel(number, label);
    }
  }

  await addLabels(number, ["on the bench"]);
  console.log(`  Reset #${number}: [workflow-path-test, on the bench]`);
}

// ─── Step verification ────────────────────────────────────────────────────────

async function verifyStep(number, stepNum, expectedPresent, expectedAbsent) {
  const issue = await getIssue(number);
  const actual = new Set(issue.labels.map((l) => l.name));

  const missing = expectedPresent.filter((l) => !actual.has(l));
  const unwanted = expectedAbsent.filter((l) => actual.has(l));

  if (missing.length === 0 && unwanted.length === 0) {
    return true;
  }

  const lines = [
    `## ❌ Step ${stepNum} Verification Failed`,
    "",
    `**Expected labels:** ${expectedPresent.map((l) => `\`${l}\``).join(", ") || "_none_"}`,
    `**Actual labels:** ${[...actual].map((l) => `\`${l}\``).join(", ") || "_none_"}`,
  ];
  if (missing.length)
    lines.push(`**Missing:** ${missing.map((l) => `\`${l}\``).join(", ")}`);
  if (unwanted.length)
    lines.push(
      `**Should not be present:** ${unwanted.map((l) => `\`${l}\``).join(", ")}`,
    );

  await postComment(number, lines.join("\n"));
  return false;
}

async function verifyFinalState(number, expectedStateReason) {
  const issue = await getIssue(number);

  if (issue.state === "closed" && issue.state_reason === expectedStateReason) {
    return true;
  }

  const lines = [
    `## ❌ Final State Verification Failed`,
    "",
    `**Expected:** \`closed\` with state_reason \`${expectedStateReason}\``,
    `**Actual state:** \`${issue.state}\``,
    `**Actual state_reason:** \`${issue.state_reason || "none"}\``,
  ];

  await postComment(number, lines.join("\n"));
  return false;
}

// ─── Drive a single issue ─────────────────────────────────────────────────────

async function driveIssue(number) {
  const issue = await getIssue(number);
  const { body } = issue;

  const pathMatch = body && body.match(/## Path (\d+) of \d+/);
  const pathNum = pathMatch ? parseInt(pathMatch[1], 10) : "?";

  console.log(`\n── Path ${pathNum} / Issue #${number} ──────────────────────`);

  const labelSteps = parseLabelSteps(body);
  const { exitState, stateReason } = parseExit(body);

  console.log(`  Exit: ${exitState} → close as "${stateReason}"`);
  console.log(`  Label steps: ${labelSteps.length}`);
  if (DRY_RUN) {
    for (const s of labelSteps) {
      console.log(`    Step ${s.step}: +[${s.add}] -[${s.remove}]`);
    }
    return { number, pathNum, result: "dry-run" };
  }

  // 1. Reset to clean initial state
  await resetIssue(number);

  // Cumulative expected label set (starts at reset state)
  const presentLabels = new Set(["workflow-path-test", "on the bench"]);
  let failed = false;

  // 2. Apply each label-change step and verify
  for (const { step, add, remove } of labelSteps) {
    if (add.length) await addLabels(number, add);
    for (const l of remove) await removeLabel(number, l);

    for (const l of add) presentLabels.add(l);
    for (const l of remove) presentLabels.delete(l);

    const ok = await verifyStep(number, step, [...presentLabels], remove);
    console.log(`  Step ${step}: ${ok ? "✓" : "✗ FAIL"}`);
    if (!ok) failed = true;
  }

  // 3. Close with the expected state reason
  await setIssueState(number, "closed", stateReason);

  // 4. Verify final closed state
  const finalOk = await verifyFinalState(number, stateReason);
  console.log(`  Final state: ${finalOk ? "✓" : "✗ FAIL"}`);
  if (!finalOk) failed = true;

  // 5. Check the path checkbox if everything passed
  if (!failed && body.includes("- [ ] Path followed correctly")) {
    const updatedBody = body.replace(
      "- [ ] Path followed correctly",
      "- [x] Path followed correctly",
    );
    await updateBody(number, updatedBody);
    console.log(`  Checked off "Path followed correctly"`);
  }

  const result = failed ? "FAIL" : "PASS";
  console.log(`  Result: ${result}`);
  return { number, pathNum, result };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!TOKEN) {
    console.error("GITHUB_TOKEN or TOKEN environment variable must be set");
    process.exit(1);
  }

  console.log(`Repository : ${OWNER}/${REPO_NAME}`);
  console.log(`Dry run    : ${DRY_RUN}`);
  if (ISSUE_FILTER)
    console.log(`Filter     : issues ${ISSUE_FILTER.join(", ")}`);

  // Fetch all workflow-path-test issues (open and closed, for reset support)
  const issues = await ghGet(
    `/repos/${OWNER}/${REPO_NAME}/issues?labels=workflow-path-test&state=all&per_page=100`,
  );

  const targets = issues
    .filter((i) => !ISSUE_FILTER || ISSUE_FILTER.includes(i.number))
    .sort((a, b) => a.number - b.number);

  console.log(`\nFound ${targets.length} issue(s) to drive\n`);

  const results = [];
  for (const issue of targets) {
    const r = await driveIssue(issue.number);
    results.push(r);
  }

  // Summary table
  const pad = (v, n) => String(v).padEnd(n);
  console.log("\n═══ SUMMARY ════════════════════════════════════");
  console.log(`${pad("Path", 6)}${pad("Issue", 8)}Result`);
  console.log("─".repeat(30));
  for (const r of results) {
    console.log(`${pad(r.pathNum, 6)}${pad(`#${r.number}`, 8)}${r.result}`);
  }

  const passed = results.filter((r) => r.result === "PASS").length;
  const failed = results.filter((r) => r.result === "FAIL").length;
  const skipped = results.filter(
    (r) => !["PASS", "FAIL"].includes(r.result),
  ).length;
  console.log("─".repeat(30));
  console.log(`${passed} passed  ${failed} failed  ${skipped} skipped`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
