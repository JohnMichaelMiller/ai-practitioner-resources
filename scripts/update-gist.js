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

// Configuration - use test gist if in test mode
const GIST_TOKEN = IS_TEST_MODE
  ? process.env.TEST_GIST_TOKEN
  : process.env.GIST_TOKEN;
const GIST_ID = IS_TEST_MODE ? process.env.TEST_GIST_ID : process.env.GIST_ID;
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

  const mergedResources = fs.readFileSync(MERGED_RESOURCES_PATH, "utf8");
  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

  console.log(`   Timestamp: ${timestamp}`);

  const gistUrl = `https://api.github.com/gists/${GIST_ID}`;

  // Prepare update data with both current and archived versions
  const updateData = {
    files: {
      "resources.json": {
        content: mergedResources,
      },
      [`resources.${timestamp}.json`]: {
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
      throw new Error(
        `Failed to update gist: ${response.status} ${response.statusText}\n${errorText}`,
      );
    }

    const result = await response.json();

    console.log("✅ Gist updated successfully");
    console.log(`   Current version: resources.json`);
    console.log(`   Archived version: resources.${timestamp}.json`);
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
