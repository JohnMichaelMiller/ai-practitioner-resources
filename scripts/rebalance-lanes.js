// Rebalance Project 1 Status on close-only events.
// Rules implemented (see .github/prompts/modes/project-manager.md):
// - Status values: "at bat", "on deck", "in the hole"; everything else → "on the bench"
// - Caps: 3 each for at bat/on deck/in the hole
// - Active pipeline only includes issues labeled "implementation ready"
// - Choose top items by Priority Score desc; tiebreakers: independence (true first), smaller size, older issue
// - Independence: label "independent" or "independence:high" → true; default false
// - Size labels: "size:small|medium|large" → small<medium<large; default medium
// - Set Project 1 Status accordingly and remove any legacy lane labels if present

const fetch = require("node-fetch");

const LANES = ["at bat", "on deck", "in the hole", "on the bench"];

function toLabelSet(labels) {
  return new Set(
    labels
      .map((l) => (typeof l === "string" ? l : l.name))
      .filter(Boolean)
      .map((n) => n.trim())
  );
}

function hasLabel(labelsSet, name) {
  const target = name.toLowerCase();
  for (const l of labelsSet) {
    if (l.toLowerCase() === target) return true;
  }
  return false;
}

function extractScore(labelsSet) {
  // Look for labels like "priority:85" or "score:92"
  let score = 0;
  for (const l of labelsSet) {
    const m = String(l)
      .toLowerCase()
      .match(/^(?:priority|score):\s*(\d{1,3})$/);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n))
        score = Math.max(score, Math.min(100, Math.max(0, n)));
    }
  }
  return score;
}

function extractIndependence(labelsSet) {
  if ([...labelsSet].some((l) => String(l).toLowerCase() === "independent"))
    return true;
  const indep = [...labelsSet].find((l) =>
    String(l).toLowerCase().startsWith("independence:")
  );
  if (indep) {
    const val = String(indep).split(":")[1]?.trim().toLowerCase();
    return val === "high" || val === "yes" || val === "true";
  }
  return false;
}

function extractSizeRank(labelsSet) {
  // small=0, medium=1, large=2 (default medium)
  const size = [...labelsSet].find((l) =>
    String(l).toLowerCase().startsWith("size:")
  );
  const v = String(size || "")
    .split(":")[1]
    ?.trim()
    .toLowerCase();
  if (v === "small") return 0;
  if (v === "large") return 2;
  return 1; // medium or unknown
}

function sizeNameFromRank(rank) {
  return rank === 0 ? "small" : rank === 2 ? "large" : "medium";
}

function getLane(labelsSet) {
  for (const lane of LANES) {
    if (hasLabel(labelsSet, lane)) return lane;
  }
  return null;
}

function removeLaneLabels(labelsSet) {
  return new Set(
    [...labelsSet].filter(
      (l) =>
        !LANES.map((x) => x.toLowerCase()).includes(String(l).toLowerCase())
    )
  );
}

function cmpIssues(a, b) {
  // Desc score
  if (b.score !== a.score) return b.score - a.score;
  // Independence true first
  if (a.independent !== b.independent)
    return (b.independent ? 1 : 0) - (a.independent ? 1 : 0);
  // Smaller size rank first
  if (a.sizeRank !== b.sizeRank) return a.sizeRank - b.sizeRank;
  // Older (earlier created_at) first
  const at = new Date(a.created_at).getTime();
  const bt = new Date(b.created_at).getTime();
  return at - bt;
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

// GraphQL helpers for Projects v2
async function ghGraphQL(query, variables) {
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
  return match;
}

function optionIdByName(field, name) {
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

async function listOpenIssues(owner, repo) {
  const items = [];
  let page = 1;
  while (true) {
    const res = await ghFetch(
      `/repos/${owner}/${repo}/issues?state=open&per_page=100&page=${page}`
    );
    const data = await res.json();
    const onlyIssues = data.filter((i) => !i.pull_request); // exclude PRs
    items.push(...onlyIssues);
    if (data.length < 100) break;
    page += 1;
  }
  return items;
}

async function updateIssueLabels(owner, repo, number, labelsArray) {
  await ghFetch(`/repos/${owner}/${repo}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ labels: labelsArray }),
  });
}

async function main() {
  const repoFull = process.env.GITHUB_REPOSITORY;
  if (!repoFull) throw new Error("GITHUB_REPOSITORY not set");
  const [owner, repo] = repoFull.split("/");
  const projectOwner = process.env.PROJECT_OWNER || owner;
  const projectNumber = Number(process.env.PROJECT_NUMBER || 1);
  const statusFieldName = process.env.PROJECT_STATUS_FIELD_NAME || "Status";
  const laneMapRaw = process.env.LANE_STATUS_MAP || "";
  const laneMap = laneMapRaw ? JSON.parse(laneMapRaw) : null;
  const dryRun = /^(1|true|yes)$/i.test(String(process.env.DRY_RUN || ""));
  const listOnly = /^(1|true|yes)$/i.test(String(process.env.LIST_ONLY || ""));

  const openIssues = await listOpenIssues(owner, repo);

  const prepared = openIssues.map((i) => {
    const labelsSet = toLabelSet(i.labels || []);
    return {
      number: i.number,
      title: i.title,
      created_at: i.created_at,
      labelsSet,
      lane: getLane(labelsSet),
      score: extractScore(labelsSet),
      independent: extractIndependence(labelsSet),
      sizeRank: extractSizeRank(labelsSet),
      approved: hasLabel(labelsSet, "implementation ready"),
    };
  });

  // Build candidate list for active lanes: approved only (independence is a tiebreaker in sorting)
  const approvedIssues = prepared.filter((i) => i.approved);
  approvedIssues.sort(cmpIssues);

  const atBat = approvedIssues.slice(0, 3).map((i) => i.number);
  const onDeck = approvedIssues.slice(3, 6).map((i) => i.number);
  const inTheHole = approvedIssues.slice(6, 9).map((i) => i.number);

  const targets = new Map();
  for (const n of atBat) targets.set(n, "at bat");
  for (const n of onDeck) targets.set(n, "on deck");
  for (const n of inTheHole) targets.set(n, "in the hole");

  // Everything else to bench (including unapproved or not independent)
  for (const it of prepared) {
    if (!targets.has(it.number)) targets.set(it.number, "on the bench");
  }

  // If only listing, print priority ordering and exit before any mutations
  if (listOnly) {
    const approvedSorted = [...approvedIssues];
    const otherSorted = prepared.filter((i) => !i.approved).sort(cmpIssues);

    const fmt = (i) =>
      `#${i.number} [score=${i.score}, indep=${i.independent}, size=${sizeNameFromRank(i.sizeRank)}, created=${i.created_at}] ${i.title}`;

    console.log(`Priority — implementation ready (${approvedSorted.length}):`);
    for (const i of approvedSorted) console.log("  " + fmt(i));

    console.log(`\nPriority — others (${otherSorted.length}):`);
    for (const i of otherSorted) console.log("  " + fmt(i));
    return;
  }

  // Resolve project and status options
  const project = await getProject(projectOwner, projectNumber);
  const statusField = findStatusField(project, statusFieldName);
  const optionId = (name) =>
    optionIdByName(statusField, laneMap?.[name] || name);

  // Apply Status updates and remove any legacy lane labels
  for (const it of prepared) {
    const desiredLane = targets.get(it.number) || "on the bench";
    const option = optionId(desiredLane);
    if (!option) {
      console.warn(
        `#${it.number}: desired status '${desiredLane}' not found — SKIP`
      );
      continue;
    }
    // Ensure we have node_id for GraphQL calls
    if (!it.node_id) {
      const res = await ghFetch(`/repos/${owner}/${repo}/issues/${it.number}`);
      const fresh = await res.json();
      it.node_id = fresh.node_id;
    }
    let itemId = null;
    if (!dryRun) {
      itemId = await getIssueProjectItemId(it.node_id, project.id);
      if (!itemId) itemId = await addIssueToProject(project.id, it.node_id);
      if (!itemId) {
        console.warn(`#${it.number}: could not obtain project item id — SKIP`);
        continue;
      }
      await setProjectItemStatus(project.id, itemId, statusField.id, option);
    } else {
      console.log(
        `DRY RUN: #${it.number} would set Project Status → '${desiredLane}'`
      );
    }

    // Clean up any legacy lane labels from the issue
    const clean = removeLaneLabels(it.labelsSet);
    if (clean.size !== it.labelsSet.size) {
      if (!dryRun) {
        await updateIssueLabels(owner, repo, it.number, [...clean]);
      } else {
        console.log(`DRY RUN: #${it.number} would remove legacy lane labels`);
      }
    }
    if (!dryRun) {
      console.log(`#${it.number} → ${desiredLane}`);
    }
  }

  console.log(
    `Rebalanced: at bat=${atBat.length}, on deck=${
      onDeck.length
    }, in the hole=${inTheHole.length}, bench=${
      prepared.length - (atBat.length + onDeck.length + inTheHole.length)
    }`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
