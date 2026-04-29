#!/usr/bin/env node

/**
 * Update GitHub Gist with merged resources
 *
 * This script:
 * 1. Reads the merged resources from /tmp/merged-resources.json
 * 2. Updates the gist with both resources.json (current) and a timestamped version
 * 3. Provides archive functionality with dated backups
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
const MERGED_RESOURCES_PATH = path.join("/tmp", "merged-resources.json");

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

/**
 * Update gist with merged resources
 */
async function updateGist() {
  console.log("📤 Updating GitHub Gist...");
  console.log(`   Gist ID: ${GIST_ID}`);

  // Read merged resources
  if (!fs.existsSync(MERGED_RESOURCES_PATH)) {
    console.error(
      "❌ Error: Merged resources file not found at:",
      MERGED_RESOURCES_PATH,
    );
    process.exit(1);
  }

  const mergedResourcesText = fs.readFileSync(MERGED_RESOURCES_PATH, "utf8");
  const mergedResourcesData = JSON.parse(mergedResourcesText);
  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  const fullTimestamp = new Date().toISOString();
  const environment = IS_TEST_MODE ? "test" : "production";

  // Add metadata to the resources
  mergedResourcesData.metadata = {
    last_updated: fullTimestamp,
    environment: environment,
  };

  const mergedResources = JSON.stringify(mergedResourcesData, null, 2);

  console.log(`   Timestamp: ${timestamp}`);
  console.log(`   Environment: ${environment}`);

  const gistUrl = `https://api.github.com/gists/${GIST_ID}`;

  // Use environment-specific filename
  const currentFilename = IS_TEST_MODE
    ? "resources.test.json"
    : "resources.prod.json";
  const archiveFilename = IS_TEST_MODE
    ? `resources.test.${timestamp}.json`
    : `resources.prod.${timestamp}.json`;

  // Prepare update data with both current and archived versions
  const updateData = {
    files: {
      [currentFilename]: {
        content: mergedResources,
      },
      [archiveFilename]: {
        content: mergedResources,
      },
    },
  };

  try {
    const response = await fetch(gistUrl, {
      method: "PATCH",
      headers: {
        Authorization: `token ${GIST_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "ai-practitioner-resources-automation",
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404) {
        throw new Error(
          `Failed to update gist: 404 Not Found. Check GIST_ID (${GIST_ID}) and ensure GIST_TOKEN has access to that gist.\n${errorText}`,
        );
      }
      throw new Error(
        `Failed to update gist: ${response.status} ${response.statusText}\n${errorText}`,
      );
    }

    const result = await response.json();

    console.log("✅ Gist updated successfully");
    console.log(`   Current version: ${currentFilename}`);
    console.log(`   Archived version: ${archiveFilename}`);
    console.log(`   Gist URL: ${result.html_url}`);

    return result;
  } catch (error) {
    console.error("❌ Failed to update gist:", error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log("🚀 Update Gist Script\n");
  await updateGist();
  console.log("\n✨ Done!\n");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
