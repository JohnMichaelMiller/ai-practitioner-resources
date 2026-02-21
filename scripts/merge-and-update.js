#!/usr/bin/env node

/**
 * Merge new resources with current resources and update weeks_on_list
 *
 * This script:
 * 1. Reads current resources from /tmp/current-resources.json
 * 2. Reads new resources from /tmp/new-resources.json
 * 3. Matches resources by title and source
 * 4. Increments weeks_on_list for matching resources
 * 5. Sets weeks_on_list to 1 for new resources
 * 6. Writes merged result to /tmp/merged-resources.json
 */

const fs = require("fs");
const path = require("path");

// File paths
const CURRENT_RESOURCES_PATH = path.join("/tmp", "current-resources.json");
const NEW_RESOURCES_PATH = path.join("/tmp", "new-resources.json");
const MERGED_RESOURCES_PATH = path.join("/tmp", "merged-resources.json");

/**
 * Normalize URL for matching (remove trailing slashes, protocol variations, www prefix)
 */
function normalizeUrl(url) {
  if (!url) return "";
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, "") // Remove protocol
    .replace(/^www\./, "") // Remove www
    .replace(/\/+$/, "") // Remove trailing slashes
    .replace(/\/$/, ""); // Remove final slash
}

/**
 * Normalize title for matching (trim, lowercase, remove special chars)
 */
function normalizeTitle(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .trim()
    .replace(/[:\-—–]/g, " ") // Replace separators with spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity between two titles (0-1, higher is more similar)
 * Uses multiple strategies:
 * 1. Exact normalized match = 1.0
 * 2. One contains the other = 0.9
 * 3. Word overlap > 70% = 0.8
 * 4. Significant word overlap > 50% = 0.7
 */
function titleSimilarity(title1, title2) {
  if (!title1 || !title2) return 0;

  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  // Exact match
  if (norm1 === norm2) return 1.0;

  // One contains the other (handles subtitle differences)
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;

  // Word overlap calculation
  const words1 = new Set(norm1.split(" ").filter((w) => w.length > 2)); // Ignore short words
  const words2 = new Set(norm2.split(" ").filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  const overlap = intersection.size / union.size;

  if (overlap > 0.7) return 0.8;
  if (overlap > 0.5) return 0.7;

  return 0;
}

/**
 * Calculate similarity between two URLs (0-1, higher is more similar)
 */
function urlSimilarity(url1, url2) {
  if (!url1 || !url2) return 0;

  const norm1 = normalizeUrl(url1);
  const norm2 = normalizeUrl(url2);

  // Exact match
  if (norm1 === norm2) return 1.0;

  // Same domain
  const domain1 = norm1.split("/")[0];
  const domain2 = norm2.split("/")[0];
  if (domain1 === domain2) return 0.7;

  return 0;
}

/**
 * Merge and update resources
 */
function mergeAndUpdateResources() {
  console.log("🔄 Merging resources and updating weeks_on_list...");

  // Read files
  if (!fs.existsSync(CURRENT_RESOURCES_PATH)) {
    console.error(
      "❌ Error: Current resources file not found at:",
      CURRENT_RESOURCES_PATH,
    );
    process.exit(1);
  }

  if (!fs.existsSync(NEW_RESOURCES_PATH)) {
    console.error(
      "❌ Error: New resources file not found at:",
      NEW_RESOURCES_PATH,
    );
    process.exit(1);
  }

  const currentResources = JSON.parse(
    fs.readFileSync(CURRENT_RESOURCES_PATH, "utf8"),
  );
  const newResources = JSON.parse(fs.readFileSync(NEW_RESOURCES_PATH, "utf8"));

  console.log(
    `   Current resources: ${currentResources.resources?.length || 0}`,
  );
  console.log(`   New resources: ${newResources.resources?.length || 0}`);

  // Create array of current resources for similarity matching
  const currentResourcesArray =
    currentResources.resources && Array.isArray(currentResources.resources)
      ? currentResources.resources
      : [];

  console.log(`   Current resources: ${currentResourcesArray.length}`);

  // Update weeks_on_list for matching resources
  let exactMatched = 0;
  let fuzzyMatched = 0;
  let newCount = 0;

  if (newResources.resources && Array.isArray(newResources.resources)) {
    newResources.resources.forEach((newResource) => {
      let bestMatch = null;
      let bestScore = 0;
      let matchType = "none";

      // Try to find the best match among current resources
      currentResourcesArray.forEach((currentResource) => {
        const titleSim = titleSimilarity(
          newResource.title,
          currentResource.title,
        );
        const urlSim = urlSimilarity(
          newResource.source,
          currentResource.source,
        );

        // Scoring strategy:
        // - Exact title + exact URL = 2.0 (perfect match)
        // - High title similarity (0.9-1.0) + any URL match = good match
        // - Title similarity 0.8+ OR URL exact match = potential match
        let score = 0;

        if (titleSim === 1.0 && urlSim === 1.0) {
          score = 2.0; // Perfect match
        } else if (titleSim >= 0.9 && urlSim >= 0.7) {
          score = 1.8; // Very strong match (handles subtitles + same domain)
        } else if (titleSim >= 0.9) {
          score = 1.5; // Strong title match alone (different URLs ok)
        } else if (titleSim >= 0.8 && urlSim >= 0.7) {
          score = 1.3; // Good match (word overlap + same domain)
        } else if (titleSim >= 0.7 && urlSim === 1.0) {
          score = 1.2; // Decent title match + exact URL
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = currentResource;
          if (score >= 2.0) matchType = "exact";
          else if (score >= 1.3) matchType = "fuzzy";
          else matchType = "weak";
        }
      });

      // Accept match if score is high enough (1.2+)
      if (bestMatch && bestScore >= 1.2) {
        newResource.weeks_on_list = (bestMatch.weeks_on_list || 1) + 1;
        if (matchType === "exact") {
          exactMatched++;
        } else {
          fuzzyMatched++;
        }
      } else {
        // New resource, set to 1
        newResource.weeks_on_list = 1;
        newCount++;
      }
    });
  }

  console.log(`   Exact matches: ${exactMatched}`);
  console.log(`   Fuzzy matches: ${fuzzyMatched}`);
  console.log(`   New resources: ${newCount}`);

  // Create /tmp directory if it doesn't exist
  const tmpDir = "/tmp";
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Write merged result
  fs.writeFileSync(
    MERGED_RESOURCES_PATH,
    JSON.stringify(newResources, null, 2),
  );

  console.log("✅ Resources merged successfully");
  console.log(`   Output: ${MERGED_RESOURCES_PATH}`);

  return newResources;
}

// Main execution
function main() {
  console.log("🚀 Merge and Update Resources Script\n");
  mergeAndUpdateResources();
  console.log("\n✨ Done!\n");
}

main();
