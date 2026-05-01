// AI Code Review script — Stage 2 of the PR review pipeline.
// Fetches the PR diff, calls an AI model for a structured code review,
// posts a comment with round number and findings, and exits 0 (approved)
// or 1 (changes requested) so the calling workflow can gate downstream jobs.
//
// AI provider preference: Anthropic Claude (ANTHROPIC_API_KEY) first,
// falling back to OpenAI GPT-4 (OPENAI_API_KEY).

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function env(name, required = true) {
  const v = process.env[name];
  if (required && !v) throw new Error(`${name} not set`);
  return v;
}

async function ghFetch(url, opts = {}) {
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

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function getPRDiff(owner, repo, pullNumber) {
  const res = await ghFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
    headers: { Accept: "application/vnd.github.v3.diff" },
  });
  return res.text();
}

async function getPR(owner, repo, pullNumber) {
  const res = await ghFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  return res.json();
}

async function getIssue(owner, repo, number) {
  const res = await ghFetch(`/repos/${owner}/${repo}/issues/${number}`);
  return res.json();
}

async function addComment(owner, repo, number, body) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

// ---------------------------------------------------------------------------
// AI API with retry
// ---------------------------------------------------------------------------

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
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
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
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
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
        "Configure at least one of these secrets to enable AI code review."
    );
  }

  // Prefer Anthropic
  if (anthropicKey) {
    const model =
      process.env.ANTHROPIC_MODEL || "claude-opus-4-5";
    console.log(`Using Anthropic Claude (${model})`);
    const payload = {
      model,
      system: systemPrompt,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        { role: "user", content: [{ type: "text", text: prompt }] },
      ],
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
    max_tokens: 4096,
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

// Maximum number of lines to include from the project conventions file.
// Keeps the AI prompt within a reasonable token budget.
const MAX_CONVENTIONS_LINES = 150;

// Maximum diff characters to include in the AI prompt.
// Diffs larger than this are truncated to prevent exceeding model context limits.
const MAX_DIFF_LENGTH = 50000;

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

module.exports.extractLinkedIssueNumber = extractLinkedIssueNumber;
module.exports.extractAcceptanceCriteria = extractAcceptanceCriteria;
function readProjectConventions() {
  const conventionsPath = path.resolve(
    process.cwd(),
    ".github/copilot-instructions.md"
  );
  if (fs.existsSync(conventionsPath)) {
    // Include only the first MAX_CONVENTIONS_LINES lines to keep the prompt manageable
    const lines = fs.readFileSync(conventionsPath, "utf8").split("\n");
    return lines.slice(0, MAX_CONVENTIONS_LINES).join("\n");
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const REVIEW_DIMENSIONS = [
  "**Architecture & Design** — Does the design align with the project architecture? Are abstractions appropriate?",
  "**Code Quality** — Is the code clean, readable, and maintainable?",
  "**Testing Adequacy** — Are there adequate tests for the changes?",
  "**Error Handling** — Are errors properly caught and handled?",
  "**Security (OWASP Top 10)** — Any injection, authentication, XSS, or other security issues?",
  "**Documentation** — Are public APIs and complex logic documented?",
  "**Performance** — Any obvious performance bottlenecks or inefficiencies?",
  "**Patterns & Conventions** — Does the code follow project conventions?",
];

function buildReviewPrompt({
  diff,
  prTitle,
  prBody,
  acceptanceCriteria,
  conventions,
  reviewRound,
}) {
  const diffContent =
    diff.length > MAX_DIFF_LENGTH
      ? diff.slice(0, MAX_DIFF_LENGTH) + `\n\n[Diff truncated at ${MAX_DIFF_LENGTH} characters]`
      : diff;

  let prompt = `You are performing code review round ${reviewRound} of 3 for the following pull request.\n\n`;
  prompt += `## Pull Request\n\n**Title:** ${prTitle}\n\n**Body:**\n${prBody || "(no body)"}\n\n`;

  if (acceptanceCriteria) {
    prompt += `## Linked Issue — Acceptance Criteria\n\n${acceptanceCriteria}\n\n`;
  }

  if (conventions) {
    prompt += `## Project Conventions (excerpt)\n\n${conventions}\n\n`;
  }

  prompt += `## Code Diff\n\n\`\`\`diff\n${diffContent}\n\`\`\`\n\n`;

  prompt += `## Review Instructions\n\nReview the diff across all of the following dimensions:\n\n`;
  REVIEW_DIMENSIONS.forEach((dim, i) => {
    prompt += `${i + 1}. ${dim}\n`;
  });

  prompt += `
Respond with ONLY a JSON object (no markdown fences, no extra text) in exactly this format:
{
  "approved": <boolean — true only when there are NO critical or high severity issues>,
  "issues": [
    {
      "file": "<file path relative to repo root>",
      "line": <line number as integer, or null if not applicable>,
      "severity": "<critical|high|medium|low>",
      "description": "<clear description of the issue>",
      "suggestion": "<concrete suggestion for how to fix it>"
    }
  ],
  "summary": "<2-3 sentence overall assessment of the PR>"
}
`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Comment formatting
// ---------------------------------------------------------------------------

function buildCommentBody({ reviewRound, result }) {
  const totalIssues = (result.issues || []).length;
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of result.issues || []) {
    if (counts[issue.severity] !== undefined) counts[issue.severity]++;
  }

  const statusEmoji = result.approved ? "✅" : "❌";
  const statusText = result.approved ? "APPROVED" : "CHANGES REQUESTED";

  let comment = `## 🤖 Code Review - Round ${reviewRound}/3\n\n`;
  comment += `**Status:** ${statusEmoji} ${statusText}\n\n`;
  comment += `**Summary:** ${result.summary || "No summary provided."}\n\n`;

  if (totalIssues > 0) {
    comment += `### Issues Found (${totalIssues} total)\n\n`;
    if (counts.critical > 0)
      comment += `- 🔴 **Critical:** ${counts.critical}\n`;
    if (counts.high > 0) comment += `- 🟠 **High:** ${counts.high}\n`;
    if (counts.medium > 0) comment += `- 🟡 **Medium:** ${counts.medium}\n`;
    if (counts.low > 0) comment += `- 🟢 **Low:** ${counts.low}\n`;
    comment += "\n";

    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedIssues = [...result.issues].sort(
      (a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4)
    );

    for (const issue of sortedIssues) {
      const sevEmoji =
        { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" }[
          issue.severity
        ] || "⚪";
      const sevLabel =
        issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1);
      const fileRef = issue.file ? `\`${issue.file}\`` : "unknown file";
      const lineRef = issue.line ? ` (line ${issue.line})` : "";
      comment += `#### ${sevEmoji} ${sevLabel}: ${fileRef}${lineRef}\n\n`;
      comment += `**Issue:** ${issue.description}\n\n`;
      if (issue.suggestion) {
        comment += `**Suggestion:** ${issue.suggestion}\n\n`;
      }
      comment += "---\n\n";
    }
  } else {
    comment += "### No Issues Found\n\nThe code looks good across all review dimensions.\n\n";
  }

  const nextAction = result.approved
    ? "This PR has been approved by the AI reviewer and is ready for the next stage."
    : reviewRound >= 3
    ? "Three review rounds have been completed without approval. This PR has been escalated for human review."
    : `Please address the issues above and push new commits to trigger round ${reviewRound + 1}.`;

  comment += `---\n\n_Round ${reviewRound} of 3. ${nextAction}_`;
  return comment;
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
      prNumber =
        event?.pull_request?.number || event?.number || 0;
    }
  }
  if (!prNumber) {
    throw new Error(
      "PR_NUMBER is not set and could not be read from GITHUB_EVENT_PATH"
    );
  }

  const reviewRound = parseInt(process.env.REVIEW_ROUND, 10) || 1;

  console.log(`Repository:    ${owner}/${repo}`);
  console.log(`PR Number:     ${prNumber}`);
  console.log(`Review Round:  ${reviewRound}`);

  // Fetch PR metadata
  console.log("Fetching PR metadata...");
  const pr = await getPR(owner, repo, prNumber);
  const prTitle = pr.title || "";
  const prBody = pr.body || "";

  // Fetch PR diff
  console.log("Fetching PR diff...");
  const diff = await getPRDiff(owner, repo, prNumber);

  // Fetch linked issue acceptance criteria if available
  let acceptanceCriteria = null;
  const issueNumber = extractLinkedIssueNumber(prBody);
  if (issueNumber) {
    console.log(
      `Found linked issue #${issueNumber}, fetching acceptance criteria...`
    );
    try {
      const issue = await getIssue(owner, repo, issueNumber);
      acceptanceCriteria = extractAcceptanceCriteria(issue.body);
      if (acceptanceCriteria) {
        console.log("Extracted acceptance criteria from linked issue.");
      } else {
        console.log("No '## Acceptance Criteria' section found in issue.");
      }
    } catch (e) {
      console.warn(
        `Could not fetch linked issue #${issueNumber}: ${e.message}`
      );
    }
  } else {
    console.log("No linked issue reference found in PR body.");
  }

  // Read project conventions
  const conventions = readProjectConventions();

  // Build prompt and call AI
  const systemPrompt =
    "You are an expert code reviewer performing a thorough, structured review of a GitHub pull request. " +
    "You analyze code changes for quality, correctness, security, and adherence to project conventions. " +
    "You must respond with ONLY valid JSON — no markdown code fences, no explanatory text before or after.";

  const prompt = buildReviewPrompt({
    diff,
    prTitle,
    prBody,
    acceptanceCriteria,
    conventions,
    reviewRound,
  });

  console.log("Calling AI for code review...");
  const rawResponse = await callAI(prompt, systemPrompt);

  // Parse AI response
  let result;
  try {
    const match = rawResponse.match(/\{[\s\S]*\}/);
    result = match ? JSON.parse(match[0]) : JSON.parse(rawResponse);
  } catch (e) {
    console.error("Failed to parse AI response as JSON:", e.message);
    console.error("Raw response (first 500 chars):", rawResponse.slice(0, 500));
    // Treat as unapproved with a parse-error issue
    result = {
      approved: false,
      issues: [
        {
          file: "unknown",
          line: null,
          severity: "high",
          description:
            "AI response could not be parsed as JSON. Manual review is required.",
          suggestion: "Investigate the AI response in the workflow logs.",
        },
      ],
      summary:
        "AI review response could not be parsed. Manual review is required.",
    };
  }

  // Normalize required fields
  if (typeof result.approved !== "boolean") result.approved = false;
  if (!Array.isArray(result.issues)) result.issues = [];
  if (!result.summary) result.summary = "No summary provided.";

  console.log(
    `AI Review Result: ${result.approved ? "APPROVED" : "CHANGES REQUESTED"}`
  );
  console.log(`Issues found: ${result.issues.length}`);

  // Post review comment
  const commentBody = buildCommentBody({ reviewRound, result });
  await addComment(owner, repo, prNumber, commentBody);
  console.log("Posted review comment.");

  // Write step outputs
  writeOutput("approved", result.approved ? "true" : "false");
  writeOutput("issues_count", String(result.issues.length));

  if (!result.approved) {
    console.log("AI review did not approve this PR.");
    process.exit(1);
  }

  console.log("AI review approved this PR.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error in ai-code-review.js:", err.message || err);
  process.exit(1);
});
