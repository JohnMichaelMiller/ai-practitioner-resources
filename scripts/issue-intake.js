// Issue intake on open: initialize Project 1 Status and request approval.
// - Ensure the issue is added to Project 1 (owner/number via env)
// - Set Project Status to the bench value (default: "on the bench" or mapped)
// - Apply "needs-details" when issue quality thresholds are not met

const fs = require("fs");
const fetch = require("node-fetch");

const LANES = ["at bat", "on deck", "in the hole", "on the bench"];

async function ghFetch(url, opts = {}) {
  // Prefer explicit PAT (TOKEN) over the default GITHUB_TOKEN, which often lacks access to user-owned Projects v2
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

// GraphQL helpers for Projects v2
async function ghGraphQL(query, variables) {
  // Prefer explicit PAT (TOKEN) over the default GITHUB_TOKEN, which often lacks access to user-owned Projects v2
  const token = process.env.TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("TOKEN/GITHUB_TOKEN not set");
  const url =
    process.env.GITHUB_GRAPHQL_URL || "https://api.github.com/graphql";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (!res.ok || data.errors) {
    throw new Error("GraphQL error: " + JSON.stringify(data.errors || data));
  }
  return data.data;
}

async function getProject(owner, number) {
  const fieldFragments = `fields(first:100){ nodes{ __typename ... on ProjectV2FieldCommon { id name } ... on ProjectV2SingleSelectField { id name options{ id name } } } }`;
  const qOrg = `query($login:String!,$number:Int!){ organization(login:$login){ projectV2(number:$number){ id number ${fieldFragments} } } }`;
  const qUser = `query($login:String!,$number:Int!){ user(login:$login){ projectV2(number:$number){ id number ${fieldFragments} } } }`;
  try {
    const dOrg = await ghGraphQL(qOrg, { login: owner, number });
    const projOrg = dOrg?.organization?.projectV2;
    if (projOrg) return projOrg;
  } catch (_) {}
  const dUser = await ghGraphQL(qUser, { login: owner, number });
  const projUser = dUser?.user?.projectV2;
  if (!projUser)
    throw new Error(`Project ${number} not found for owner ${owner}`);
  return projUser;
}

function findStatusField(project, statusFieldName) {
  const nodes = project.fields?.nodes || [];
  const match = nodes.find(
    (f) =>
      String(f.name).toLowerCase() === String(statusFieldName).toLowerCase()
  );
  if (!match)
    throw new Error(
      `Field '${statusFieldName}' not found in Project ${project.number}`
    );
  if (!match.options)
    throw new Error(`Field '${statusFieldName}' is not a single-select field`);
  return match; // { id,name,options[] }
}

function resolveOptionIdByName(field, name) {
  const opt = (field.options || []).find(
    (o) => String(o.name).toLowerCase() === String(name).toLowerCase()
  );
  return opt?.id || null;
}

async function getIssueProjectItemId(issueNodeId, projectId) {
  const q = `query($id:ID!){ node(id:$id){ ... on Issue { projectItems(first:20){ nodes{ id project{ id number } } } } } }`;
  const data = await ghGraphQL(q, { id: issueNodeId });
  const items = data?.node?.projectItems?.nodes || [];
  const found = items.find((n) => n.project?.id === projectId);
  return found?.id || null;
}

async function addIssueToProject(projectId, contentId) {
  const m = `mutation($projectId:ID!,$contentId:ID!){ addProjectV2ItemById(input:{projectId:$projectId, contentId:$contentId}){ item{ id } } }`;
  const data = await ghGraphQL(m, { projectId, contentId });
  return data?.addProjectV2ItemById?.item?.id || null;
}

async function setProjectItemStatus(projectId, itemId, fieldId, optionId) {
  const m = `mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$optionId:String!){ updateProjectV2ItemFieldValue(input:{ projectId:$projectId, itemId:$itemId, fieldId:$fieldId, value:{ singleSelectOptionId:$optionId }}){ projectV2Item{ id } } }`;
  await ghGraphQL(m, { projectId, itemId, fieldId, optionId });
}

async function removeIssueFromProject(projectId, itemId) {
  const m = `mutation($projectId:ID!,$itemId:ID!){ deleteProjectV2Item(input:{projectId:$projectId, itemId:$itemId}){ deletedItemId } }`;
  await ghGraphQL(m, { projectId, itemId });
}

async function getAllIssueProjectItems(issueNodeId) {
  const q = `query($id:ID!){ node(id:$id){ ... on Issue { projectItems(first:20){ nodes{ id project{ id number } } } } } }`;
  const data = await ghGraphQL(q, { id: issueNodeId });
  return data?.node?.projectItems?.nodes || [];
}

async function getIssue(owner, repo, number) {
  const res = await ghFetch(`/repos/${owner}/${repo}/issues/${number}`);
  return res.json();
}

async function listLabels(owner, repo) {
  const labels = [];
  let page = 1;
  while (true) {
    const res = await ghFetch(
      `/repos/${owner}/${repo}/labels?per_page=100&page=${page}`
    );
    const data = await res.json();
    labels.push(...data);
    if (data.length < 100) break;
    page += 1;
  }
  return labels;
}

async function ensureLabel(owner, repo, name, color, description) {
  const existing = await listLabels(owner, repo);
  const found = existing.find(
    (l) => l.name.toLowerCase() === name.toLowerCase()
  );
  if (found) return found;
  const res = await ghFetch(`/repos/${owner}/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({ name, color, description }),
  });
  return res.json();
}

function toNameSet(labels) {
  return new Set(
    (labels || [])
      .map((l) => (typeof l === "string" ? l : l.name))
      .filter(Boolean)
  );
}

function stripLaneLabels(nameSet) {
  const lowerLanes = new Set(LANES.map((l) => l.toLowerCase()));
  return new Set([...nameSet].filter((n) => !lowerLanes.has(n.toLowerCase())));
}

function assessIssueDetails(body) {
  const text = typeof body === "string" ? body : "";
  const trimmed = text.trim();
  const hasBody = trimmed.length > 0;
  const hasMinLength = trimmed.length > 50;
  const hasHeading = /(^|\n)\s*##\s+\S+/.test(text);
  const hasCheckbox = /(^|\n)\s*-\s\[[ xX]\]/.test(text);
  const hasStructuredContent = hasHeading || hasCheckbox;
  return {
    passed: hasBody && hasMinLength && hasStructuredContent,
    hasBody,
    hasMinLength,
    hasStructuredContent,
  };
}

async function setIssueLabels(owner, repo, number, names) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ labels: names }),
  });
}

async function addComment(owner, repo, number, body) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

function loadEvent() {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p) throw new Error("GITHUB_EVENT_PATH not set");
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const repoFull = process.env.GITHUB_REPOSITORY;
  if (!repoFull) throw new Error("GITHUB_REPOSITORY not set");
  const [owner, repo] = repoFull.split("/");
  const event = loadEvent();
  const number = event?.issue?.number;
  if (!number) throw new Error("Issue number not found in event payload");

  // Fetch current issue
  const issue = await getIssue(owner, repo, number);
  const labelSet = toNameSet(issue.labels);

  // Detect test issues by [TI] in title OR **TI** in body
  const isTestIssue =
    (issue.title && issue.title.includes("[TI]")) ||
    (issue.body && issue.body.includes("**TI**"));

  // Optionally manage Project item/Status here (default off when Project workflows handle it)
  const manageProject = /^(1|true|yes)$/i.test(
    String(process.env.INTAKE_MANAGE_PROJECT || "")
  );
  if (manageProject) {
    const projectOwner = process.env.PROJECT_OWNER || owner;
    // Route to test project (3) if **TI** in title, otherwise production (1)
    const projectNumber = isTestIssue
      ? 3
      : Number(process.env.PROJECT_NUMBER || 1);
    const statusFieldName = process.env.PROJECT_STATUS_FIELD_NAME || "Status";
    const laneMapRaw = process.env.LANE_STATUS_MAP || "";
    const laneMap = laneMapRaw ? JSON.parse(laneMapRaw) : null;
    const benchName = laneMap?.["on the bench"] || "on the bench";

    console.log(
      `${
        isTestIssue ? "🧪 Test issue detected" : "📋 Production issue"
      } - routing to project #${projectNumber}`
    );

    const project = await getProject(projectOwner, projectNumber);
    const statusField = findStatusField(project, statusFieldName);
    const benchOptionId = resolveOptionIdByName(statusField, benchName);
    if (!benchOptionId)
      throw new Error(
        `Status option '${benchName}' not found in Project ${project.number}`
      );

    let itemId = await getIssueProjectItemId(issue.node_id, project.id);
    if (!itemId) itemId = await addIssueToProject(project.id, issue.node_id);
    if (!itemId)
      throw new Error(`Could not create project item for issue #${number}`);
    await setProjectItemStatus(
      project.id,
      itemId,
      statusField.id,
      benchOptionId
    );

    // If this is a test issue, remove it from the production project (if present)
    if (isTestIssue && projectNumber === 3) {
      const productionProjectNumber = Number(process.env.PROJECT_NUMBER || 1);
      const productionProject = await getProject(
        projectOwner,
        productionProjectNumber
      );
      const productionItemId = await getIssueProjectItemId(
        issue.node_id,
        productionProject.id
      );
      if (productionItemId) {
        console.log(
          `Removing test issue #${number} from production project #${productionProjectNumber}`
        );
        await removeIssueFromProject(productionProject.id, productionItemId);
      }
    }
  } else {
    console.log(
      `Skipping Project item/Status management for #${number} (INTAKE_MANAGE_PROJECT not set)`
    );
  }

  // Remove any legacy lane labels if present
  let newSet = stripLaneLabels(labelSet);
  const detailsAssessment = assessIssueDetails(issue.body);
  const hadNeedsDetails = [...newSet].some(
    (label) => label.toLowerCase() === "needs-details"
  );

  if (!detailsAssessment.passed) {
    await ensureLabel(
      owner,
      repo,
      "needs-details",
      "d93f0b",
      "Issue lacks required detail for implementation"
    );
    newSet = new Set(
      [...newSet].filter((label) => label.toLowerCase() !== "needs-details")
    );
    newSet.add("needs-details");
    if (!hadNeedsDetails) {
      const missing = [];
      if (!detailsAssessment.hasBody) missing.push("- Add a non-empty issue body.");
      if (!detailsAssessment.hasMinLength)
        missing.push("- Expand the issue body to more than 50 characters.");
      if (!detailsAssessment.hasStructuredContent) {
        missing.push(
          "- Include at least one section heading (`##`) or one checklist item (`- [ ]`)."
        );
      }
      await addComment(
        owner,
        repo,
        number,
        `Thanks for opening this issue. I added the \`needs-details\` label because it is missing required intake detail:\n\n${missing.join(
          "\n"
        )}\n\nUpdate the issue body and this intake workflow will re-run automatically.`
      );
    }
  } else {
    newSet = new Set(
      [...newSet].filter((label) => label.toLowerCase() !== "needs-details")
    );
  }

  const appliedLabels = [...newSet];
  await setIssueLabels(owner, repo, number, appliedLabels);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `labels=${appliedLabels.join(",")}\nlabels_json=${JSON.stringify(
        appliedLabels
      )}\n`,
      "utf8"
    );
  }

  console.log(`#${number} intake completed (labels applied).`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = {
  assessIssueDetails,
};
