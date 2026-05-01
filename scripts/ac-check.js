// ac-check.js — Stage 3 Acceptance Criteria check for the PR review pipeline.
// Fetches the linked issue's Acceptance Criteria section and the PR diff,
// asks the AI whether every criterion is satisfied, posts a comment with
// results, and labels the PR as `ac-verified` or `ac-not-met`.
//
// Exits 0 (all criteria met) or 1 (unmet criteria found / error).
// AI provider preference: Anthropic Claude (ANTHROPIC_API_KEY) first,
// falling back to OpenAI GPT-4 (OPENAI_API_KEY).

const fs = require("fs");
const fetch = require("node-fetch");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createLocalHelpers() {
  function env(name, required = true) {
    const v = process.env[name];
    if (required && !v) throw new Error(`${name} not set`);
    return v;
  }

  async function ghFetch(url, opts = {}) {
    // TOKEN is supported as a local-testing alias; GITHUB_TOKEN is used in CI.
    const token = process.env.TOKEN || process.env.GITHUB_TOKEN;
    if (!token) throw new Error("TOKEN/GITHUB_TOKEN not set");
    const base = process.env.GITHUB_API_URL || "https://api.github.com";
    const res = await fetch(base + url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `GitHub API ${res.status} ${res.statusText} for ${url}: ${text}`
      );
    }
    return res;
  }

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return { env, ghFetch, sleep };
}

function loadSharedHelpers() {
  try {
    const sharedHelpers = require("./lib/review-helpers");
    if (
      sharedHelpers &&
      typeof sharedHelpers.env === "function" &&
      typeof sharedHelpers.ghFetch === "function" &&
      typeof sharedHelpers.sleep === "function"
    ) {
      return sharedHelpers;
    }
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }

  return createLocalHelpers();
}

const { env, ghFetch, sleep } = loadSharedHelpers();
// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function getPR(owner, repo, pullNumber) {
  const res = await ghFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  return res.json();
}

async function getPRDiff(owner, repo, pullNumber) {
  const res = await ghFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
    headers: { Accept: "application/vnd.github.v3.diff" },
  });
  return res.text();
}

async function getIssue(owner, repo, number) {
  const res = await ghFetch(`/repos/${owner}/${repo}/issues/${number}`);
  return res.json();
}

async function addComment(owner, repo, number, body) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

async function addLabel(owner, repo, number, label) {
  try {
    await ghFetch(`/repos/${owner}/${repo}/issues/${number}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels: [label] }),
    });
  } catch (e) {
    console.warn(`Could not add label '${label}': ${e.message}`);
  }
}

async function removeLabel(owner, repo, number, label) {
  try {
    await ghFetch(
      `/repos/${owner}/${repo}/issues/${number}/labels/${encodeURIComponent(label)}`,
      { method: "DELETE" }
    );
  } catch (e) {
    if (e.message && e.message.includes("404")) {
      // Label not present — nothing to do
    } else {
      console.warn(`Could not remove label '${label}': ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// AI API with retry
// ---------------------------------------------------------------------------

// Maximum backoff delay (ms) between AI API retry attempts.
const MAX_BACKOFF_MS = 10000;

async function callAIWithRetry(url, payload, headers, maxRetries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        const status = res.status;
        if (status >= 400 && status < 500 && status !== 429) {
          throw new Error(`AI API ${status} ${res.statusText}: ${text}`);
        }
        lastError = new Error(`AI API ${status} ${res.statusText}: ${text}`);
        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
          console.warn(
            `AI API error (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms...`
          );
          await sleep(backoffMs);
          continue;
        }
        throw lastError;
      }
      return await res.json();
    } catch (error) {
      lastError = error;
      if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        throw error;
      }
      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        console.warn(
          `Network error (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms: ${error.message}`
        );
        await sleep(backoffMs);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

async function callAI(prompt, systemPrompt) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    throw new Error(
      "Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set. " +
        "Configure at least one of these secrets to enable AC checking."
    );
  }

  // Prefer Anthropic
  if (anthropicKey) {
    const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-5";
    console.log(`Using Anthropic Claude (${model})`);
    const payload = {
      model,
      system: systemPrompt,
      max_tokens: 2048,
      temperature: 0.1,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    };
    const data = await callAIWithRetry(
      "https://api.anthropic.com/v1/messages",
      payload,
      {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      }
    );
    return (
      (data?.content || []).map((b) => b?.text || "").join("\n").trim() || ""
    );
  }

  // Fall back to OpenAI
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  console.log(`Using OpenAI (${model})`);
  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: 2048,
    temperature: 0.1,
  };
  const data = await callAIWithRetry(
    "https://api.openai.com/v1/chat/completions",
    payload,
    { Authorization: `Bearer ${openaiKey}` }
  );
  return data?.choices?.[0]?.message?.content || "";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Maximum diff characters to include in the AI prompt.
// Diffs larger than this are truncated to prevent exceeding model context limits
// while keeping the prompt within a reasonable cost/token budget (~10k tokens).
const MAX_DIFF_LENGTH = 40000;

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

function extractLinkedIssueNumber(body) {
  if (!body) return null;
  const match = body.match(/(?:Closes|Fixes)\s+#(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractAcceptanceCriteria(issueBody) {
  if (!issueBody) return null;
  const match = issueBody.match(
    /##\s*Acceptance Criteria\s*\r?\n([\s\S]*?)(?=\r?\n##|$)/i
  );
  if (!match) return null;
  const criteria = match[1].trim();
  return criteria || null;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function writeOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${key}=${value}\n`);
  }
  console.log(`Output: ${key}=${value}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const repoFull = env("GITHUB_REPOSITORY");
  const [owner, repo] = repoFull.split("/");

  // Resolve PR number
  let prNumber = parseInt(process.env.PR_NUMBER, 10) || 0;
  if (!prNumber) {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (eventPath && fs.existsSync(eventPath)) {
      const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
      prNumber = event?.pull_request?.number || event?.number || 0;
    }
  }
  if (!prNumber) {
    throw new Error(
      "PR_NUMBER is not set and could not be read from GITHUB_EVENT_PATH"
    );
  }

  console.log(`Repository:  ${owner}/${repo}`);
  console.log(`PR Number:   ${prNumber}`);

  // Fetch PR metadata
  console.log("Fetching PR metadata...");
  const pr = await getPR(owner, repo, prNumber);
  const prBody = pr.body || "";

  // Extract linked issue number
  const issueNumber = extractLinkedIssueNumber(prBody);
  if (!issueNumber) {
    console.log(
      "No linked issue reference found in PR body. Skipping AC check."
    );
    const comment = [
      "## ℹ️ Stage 3 — Acceptance Criteria",
      "",
      "No linked issue was found in this PR body (`Closes #NNN` or `Fixes #NNN`).",
      "Acceptance criteria verification was skipped.",
      "",
      "_Add an issue reference to enable automated AC checking._",
    ].join("\n");
    await addComment(owner, repo, prNumber, comment);
    await removeLabel(owner, repo, prNumber, "ac-not-met");
    await addLabel(owner, repo, prNumber, "ac-verified");
    writeOutput("criteria_met", "true");
    process.exit(0);
  }

  console.log(`Found linked issue #${issueNumber}.`);

  // Fetch issue and extract acceptance criteria
  let acceptanceCriteria = null;
  let issueFetchFailed = false;
  let issueFetchErrorMessage = "";
  try {
    const issue = await getIssue(owner, repo, issueNumber);
    acceptanceCriteria = extractAcceptanceCriteria(issue.body);
  } catch (e) {
    issueFetchFailed = true;
    issueFetchErrorMessage = e.message;
    console.warn(`Could not fetch linked issue #${issueNumber}: ${e.message}`);
  }

  if (issueFetchFailed) {
    const comment = [
      `## ℹ️ Stage 3 — Acceptance Criteria`,
      "",
      `Linked issue #${issueNumber} could not be fetched, so acceptance criteria verification could not be completed.`,
      "",
      `Error: ${issueFetchErrorMessage}`,
      "",
      "_This check failed closed to avoid incorrectly marking acceptance criteria as verified when the linked issue is temporarily unavailable._",
    ].join("\n");
    await addComment(owner, repo, prNumber, comment);
    await addLabel(owner, repo, prNumber, "ac-not-met");
    writeOutput("criteria_met", "false");
    process.exit(1);
  }
  if (!acceptanceCriteria) {
    console.log(
      `No '## Acceptance Criteria' section found in issue #${issueNumber}. Skipping AC check.`
    );
    const comment = [
      `## ℹ️ Stage 3 — Acceptance Criteria`,
      "",
      `Linked issue #${issueNumber} does not contain an \`## Acceptance Criteria\` section.`,
      "Acceptance criteria verification was skipped.",
      "",
      "_Add an `## Acceptance Criteria` section to the linked issue to enable automated checking._",
    ].join("\n");
    await addComment(owner, repo, prNumber, comment);
    await removeLabel(owner, repo, prNumber, "ac-not-met");
    await addLabel(owner, repo, prNumber, "ac-verified");
    writeOutput("criteria_met", "true");
    process.exit(0);
  }

  console.log("Extracted acceptance criteria from linked issue.");

  // Fetch PR diff
  console.log("Fetching PR diff...");
  const rawDiff = await getPRDiff(owner, repo, prNumber);
  const diff =
    rawDiff.length > MAX_DIFF_LENGTH
      ? rawDiff.slice(0, MAX_DIFF_LENGTH) +
        `\n\n[Diff truncated at ${MAX_DIFF_LENGTH} characters]`
      : rawDiff;

  // Build AI prompt
  const systemPrompt =
    "You are a meticulous QA engineer verifying whether a GitHub pull request satisfies " +
    "the acceptance criteria of the linked issue. " +
    "You must respond with ONLY valid JSON — no markdown code fences, no explanatory text before or after.";

  const prompt = [
    "Given the following acceptance criteria and pull request diff, determine whether every criterion is fully satisfied by the changes.",
    "",
    `## Acceptance Criteria (from issue #${issueNumber})`,
    "",
    acceptanceCriteria,
    "",
    "## Pull Request Diff",
    "",
    "```diff",
    diff,
    "```",
    "",
    "Respond with ONLY a JSON object in exactly this format:",
    "{",
    '  "met": <boolean, true only when ALL criteria are satisfied>,',
    '  "unmet": ["<exact text of each unmet criterion>"],',
    '  "summary": "<2-3 sentence overall assessment>"',
    "}",
  ].join("\n");

  console.log("Calling AI for acceptance criteria check...");
  const rawResponse = await callAI(prompt, systemPrompt);

  // Parse AI response
  let result;
  try {
    const match = rawResponse.match(/\{[\s\S]*\}/);
    result = match ? JSON.parse(match[0]) : JSON.parse(rawResponse);
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", e.message);
    console.error("Raw response (first 500 chars):", rawResponse.slice(0, 500));
    // Treat as unmet — require human review
    result = {
      met: false,
      unmet: ["AI response could not be parsed. Manual review required."],
      summary:
        "AC check AI response could not be parsed. Manual review is required.",
    };
  }

  // Normalize required fields
  if (typeof result.met !== "boolean") result.met = false;
  if (!Array.isArray(result.unmet)) result.unmet = [];
  if (!result.summary) result.summary = "No summary provided.";

  console.log(`AC Check Result: ${result.met ? "ALL MET" : "UNMET CRITERIA"}`);
  if (!result.met) {
    console.log(`Unmet criteria (${result.unmet.length}):`);
    result.unmet.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  }

  if (result.met) {
    // Remove ac-not-met label if present, add ac-verified
    await removeLabel(owner, repo, prNumber, "ac-not-met");
    await addLabel(owner, repo, prNumber, "ac-verified");

    const comment = [
      `## ✅ Stage 3 — Acceptance Criteria Verified`,
      "",
      `All acceptance criteria from issue #${issueNumber} are satisfied by this PR.`,
      "",
      `**Summary:** ${result.summary}`,
      "",
      "---",
      "_Ready for CI/CD checks._",
    ].join("\n");
    await addComment(owner, repo, prNumber, comment);
    console.log("Posted AC verified comment.");

    writeOutput("criteria_met", "true");
    process.exit(0);
  } else {
    // Remove ac-verified label if present, add ac-not-met
    await removeLabel(owner, repo, prNumber, "ac-verified");
    await addLabel(owner, repo, prNumber, "ac-not-met");

    const unmetList = result.unmet
      .map((c) => `- ❌ ${c}`)
      .join("\n");

    const comment = [
      `## ❌ Stage 3 — Acceptance Criteria Not Met`,
      "",
      `The following acceptance criteria from issue #${issueNumber} are **not yet satisfied** by this PR:`,
      "",
      unmetList,
      "",
      `**Summary:** ${result.summary}`,
      "",
      "---",
      "_Please address the unmet criteria and push new commits to re-trigger this check._",
    ].join("\n");
    await addComment(owner, repo, prNumber, comment);
    console.log("Posted AC unmet comment.");

    writeOutput("criteria_met", "false");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error in ac-check.js:", err.message || err);
  process.exit(1);
});
