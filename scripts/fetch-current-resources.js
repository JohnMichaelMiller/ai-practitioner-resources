#!/usr/bin/env node

/**
 * Fetch current resources from GitHub Gist
 *
 * This script fetches the existing resources.json from the configured GitHub Gist
 * and saves it to /tmp/current-resources.json for use by merge script.
 *
 * Required environment variables:
 *   - GIST_TOKEN: Personal access token with gist permissions
 *   - GIST_ID: The ID of the target gist
 */
// Load environment variables from .env file
require("dotenv").config();
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

// Check if running in test mode
const IS_TEST_MODE = process.env.TEST_MODE === "true";

function extractGistId(value) {
  if (!value) return "";
  const trimmed = value.trim();

  // Support raw gist IDs directly.
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return trimmed;
  }

  // Support gist URLs by extracting the trailing id segment.
  const match = trimmed.match(/\/([a-f0-9]{32})(?:\/|$)/i);
  return match ? match[1] : trimmed;
}

// Configuration - use test gist if in test mode
const GIST_TOKEN = IS_TEST_MODE
  ? process.env.TEST_GIST_TOKEN || process.env.TEST_GITHUB_GIST_TOKEN
  : process.env.GIST_TOKEN || process.env.GITHUB_GIST_TOKEN;
const RAW_GIST_ID = IS_TEST_MODE
  ? process.env.TEST_GIST_ID
  : process.env.GIST_ID;
const GIST_ID = extractGistId(RAW_GIST_ID);

// Log mode
if (IS_TEST_MODE) {
  console.log("🧪 Running in TEST mode");
} else {
  console.log("🚀 Running in PRODUCTION mode");
}

// Validate configuration
if (!GIST_TOKEN) {
  console.error("❌ Error: GIST_TOKEN environment variable is required");
  process.exit(1);
}

if (!GIST_ID) {
  console.error("❌ Error: GIST_ID environment variable is required");
  process.exit(1);
}

if (/^(ghp_|github_pat_)/.test(GIST_ID)) {
  console.error(
    "❌ Error: GIST_ID appears to be a GitHub token. Set GIST_ID to the 32-character gist ID (or gist URL), not your PAT.",
  );
  process.exit(1);
}

/* verify that the GIST_TOKEN is not expired */
async function verifyGistToken() {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `token ${GIST_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "ai-practitioner-resources-automation",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`,
    );
  }

  const user = await response.json();
  console.log(`✅ GIST_TOKEN is valid for user: ${user.login}`);
}

/**
 * Fetch current resources from gist
 */
async function fetchCurrentResources() {
  const gistUrl = `https://api.github.com/gists/${GIST_ID}`;

  console.log("📥 Fetching current resources from gist...");
  console.log(`   Gist ID: ${GIST_ID}`);

  try {
    const response = await fetch(gistUrl, {
      headers: {
        Authorization: `token ${GIST_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "ai-practitioner-resources-automation",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `GitHub Gist not found (404). Check GIST_ID (${GIST_ID}) and ensure GIST_TOKEN can access this gist.`,
        );
      }
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`,
      );
    }

    const gist = await response.json();

    const candidateFiles = IS_TEST_MODE
      ? ["resources.test.json", "resources.json", "resources.prod.json"]
      : ["resources.prod.json", "resources.json", "resources.test.json"];
    const selectedFile = candidateFiles.find(
      (fileName) => gist.files && gist.files[fileName],
    );

    if (!selectedFile) {
      console.log(
        "⚠️  No existing resource file found in gist, starting fresh",
      );
      const emptyResources = { resources: [] };

      // Create /tmp directory if it doesn't exist
      const tmpDir = "/tmp";
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      fs.writeFileSync(
        path.join(tmpDir, "current-resources.json"),
        JSON.stringify(emptyResources, null, 2),
      );

      console.log("✅ Created empty resources file");
      return emptyResources;
    }

    console.log(`   Source file: ${selectedFile}`);
    const resourcesContent = gist.files[selectedFile].content;
    const resources = JSON.parse(resourcesContent);

    // Create /tmp directory if it doesn't exist
    const tmpDir = "/tmp";
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Write to temporary file
    fs.writeFileSync(
      path.join(tmpDir, "current-resources.json"),
      JSON.stringify(resources, null, 2),
    );

    console.log("✅ Current resources fetched successfully");
    console.log(`   Resources count: ${resources.resources?.length || 0}`);

    return resources;
  } catch (error) {
    console.error("❌ Failed to fetch current resources:", error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log("🚀 Fetch Current Resources Script\n");
  await verifyGistToken();
  await fetchCurrentResources();
  console.log("\n✨ Done!\n");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
