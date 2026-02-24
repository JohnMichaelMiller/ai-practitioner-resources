#!/usr/bin/env node

/**
 * Generate new resources using Anthropic Claude API
 *
 * This script reads the AI prompt from the instructions directory,
 * sends it to Claude API, and saves the generated JSON to /tmp/new-resources.json
 *
 * Required environment variables:
 *   - ANTHROPIC_API_KEY: API key for Claude access
 */

// Load environment variables from .env file
require("dotenv").config();

const fs = require("fs");
const path = require("path");

// Configuration
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || "0.3");
const TARGET_RESOURCE_COUNT = parseInt(
  process.env.TARGET_RESOURCE_COUNT || "20",
);
const PROMPT_PATH = path.join(
  __dirname,
  "..",
  ".github",
  "prompts",
  "ai-practitioner-resources-json.prompt.md",
);

// Validate configuration
if (!ANTHROPIC_API_KEY) {
  console.error("❌ Error: ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

if (!fs.existsSync(PROMPT_PATH)) {
  console.error("❌ Error: Prompt file not found at:", PROMPT_PATH);
  process.exit(1);
}

/**
 * Generate resources using Anthropic Claude API
 */
async function generateResources() {
  console.log("🤖 Generating new resources using Anthropic Claude API...");

  // Read the prompt file
  const promptContent = fs.readFileSync(PROMPT_PATH, "utf8");
  console.log("📄 Prompt loaded from:", PROMPT_PATH);
  console.log(`   Prompt length: ${promptContent.length} characters`);

  // Try to read current resources to enable update mode
  let currentResources = null;
  const currentResourcesPath = path.join("/tmp", "current-resources.json");
  if (fs.existsSync(currentResourcesPath)) {
    try {
      currentResources = JSON.parse(
        fs.readFileSync(currentResourcesPath, "utf8"),
      );
      console.log(
        `📋 Current resources loaded: ${currentResources.resources?.length || 0} resources`,
      );
      console.log(
        `   Operating in UPDATE mode (will maintain most existing resources)`,
      );
    } catch (error) {
      console.log(
        `⚠️  Could not parse current resources, falling back to GENERATE mode`,
      );
    }
  } else {
    console.log(`📝 No current resources found, operating in GENERATE mode`);
  }

  try {
    console.log("⏳ Calling Anthropic Claude API (this may take a minute)...");
    console.log(
      `   Temperature: ${TEMPERATURE} (${TEMPERATURE < 0.5 ? "high determinism" : TEMPERATURE < 0.7 ? "balanced discovery" : "high creativity"})`,
    );
    console.log(`   Target resource count: ${TARGET_RESOURCE_COUNT}`);

    // Build the instruction based on whether we have current resources
    let instruction;
    if (
      currentResources &&
      currentResources.resources &&
      currentResources.resources.length > 0
    ) {
      // UPDATE MODE: Maintain core while discovering new resources
      const currentResourcesList = currentResources.resources
        .map((r, i) => `${i + 1}. ${r.title} [${r.type}] - ${r.source}`)
        .join("\n");

      const currentCount = currentResources.resources.length;
      const targetCount = TARGET_RESOURCE_COUNT;
      const minKeep = Math.floor(currentCount * 0.7); // Keep at least 70% of existing
      const maxNew = targetCount - minKeep; // Remaining slots for new discoveries

      instruction = `You are an expert AI researcher maintaining and expanding a curated list of resources for developers. Generate ONLY valid JSON with no additional text.

DISCOVERY MODE INSTRUCTIONS (Temperature: ${TEMPERATURE}):
1) **MAINTAIN STABLE CORE**: Keep ${minKeep}-${currentCount} of the best resources from the current list
2) **DISCOVER NEW RESOURCES**: Add ${maxNew} new high-quality resources to reach ${targetCount} total
3) **QUALITY OVER FAMILIARITY**: Replace existing resources if you find significantly better alternatives
4) **CAST WIDE NET**: Explore diverse authoritative sources:
   - Security: OWASP, NIST, SANS, CIS Benchmarks, CERT
   - Cloud providers: AWS, Azure, Google Cloud, Oracle Cloud
   - Publishers: O'Reilly, Manning, Pragmatic Programmers, Apress
   - Organizations: IEEE, ACM, Mozilla, Apache Foundation, Linux Foundation
   - Industry leaders: ThoughtWorks, Martin Fowler, Stack Overflow, GitHub
5) Use REAL, ACTUAL resources with genuine, canonical URLs
6) Prioritize authoritative, well-maintained resources
7) Ensure all property names and string values are properly quoted with double quotes

CURRENT RESOURCE LIST (${currentCount} resources):
${currentResourcesList}

Your task: Return ${targetCount} resources total. Keep the best ${minKeep}-${currentCount} from above, and discover ${maxNew} new exceptional resources. Prioritize quality and diversity.

${promptContent}`;
    } else {
      // GENERATE MODE: Create from scratch
      instruction = `You are an expert AI researcher who curates high-quality resources for developers. Generate ONLY valid JSON with no additional text.

IMPORTANT REQUIREMENTS:
1) Generate exactly ${TARGET_RESOURCE_COUNT} diverse, high-quality resources
2) Prefer STABLE, WELL-KNOWN resources from authoritative sources:
   - Security: OWASP, NIST, SANS, Microsoft Security, AWS Security
   - Publishers: O'Reilly, Manning, Pragmatic Programmers
   - Organizations: IEEE, ACM, Mozilla, Apache, Linux Foundation
   - Industry leaders: Martin Fowler, ThoughtWorks, Stack Overflow, GitHub
3) Use REAL, ACTUAL resources with genuine, canonical URLs (never use example.com or placeholder links)
4) Favor foundational/evergreen content over trendy ephemeral articles
5) Ensure all property names and string values are properly quoted with double quotes
6) Use consistent URL formats (prefer official domains and stable permalinks)
7) Maximize diversity across types (Books, Articles, Blogs, Podcasts)

${promptContent}`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 25000,
        temperature: TEMPERATURE,
        messages: [
          {
            role: "user",
            content: instruction,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const jsonResponse = result.content[0].text;
    console.log("✅ Received response from Claude");
    console.log(`   Response length: ${jsonResponse.length} characters`);

    // Parse and validate JSON
    try {
      // Clean up the response - sometimes AI adds markdown or extra text
      let cleanedResponse = jsonResponse.trim();

      // Remove markdown code blocks if present
      cleanedResponse = cleanedResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");

      // Find JSON object boundaries
      const jsonStart = cleanedResponse.indexOf("{");
      const jsonEnd = cleanedResponse.lastIndexOf("}") + 1;

      if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error("No JSON object found in response");
      }

      let jsonOnly = cleanedResponse.substring(jsonStart, jsonEnd);
      console.log("🧹 Cleaned JSON for parsing");

      // Try to fix common JSON issues
      // Fix trailing commas
      jsonOnly = jsonOnly.replace(/,(\s*[}\]])/g, "$1");

      // Try multiple parsing strategies
      let resources;
      try {
        resources = JSON.parse(jsonOnly);
      } catch (firstError) {
        console.log("🔧 First parse failed, trying to fix common issues...");

        // Try to fix unescaped quotes by adding backslashes
        let fixedJson = jsonOnly.replace(
          /([^\\])"/g,
          (match, p1, offset, string) => {
            // Don't fix if it's a proper JSON delimiter
            const before = string[offset - 1];
            const after = string[offset + 2];
            if (
              before === ":" ||
              before === "," ||
              before === "[" ||
              before === "{" ||
              after === "," ||
              after === "}" ||
              after === "]" ||
              after === ":"
            ) {
              return match;
            }
            return p1 + '\\"';
          },
        );

        try {
          resources = JSON.parse(fixedJson);
          console.log("✅ Fixed JSON parsing succeeded");
        } catch (secondError) {
          console.log(
            "🔧 Second parse failed, trying manual property fixing...",
          );

          // Last resort: try to fix property names that might be unquoted
          fixedJson = fixedJson.replace(
            /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
            '$1"$2":',
          );

          resources = JSON.parse(fixedJson);
          console.log("✅ Manual property fixing succeeded");
        }
      }

      // Basic validation
      if (!resources.resources || !Array.isArray(resources.resources)) {
        throw new Error(
          "Generated JSON does not contain a valid resources array",
        );
      }

      console.log("✅ JSON parsed successfully");
      console.log(`   Resources generated: ${resources.resources.length}`);

      // Create /tmp directory if it doesn't exist
      const tmpDir = "/tmp";
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      // Write to temporary file
      fs.writeFileSync(
        path.join(tmpDir, "new-resources.json"),
        JSON.stringify(resources, null, 2),
      );

      console.log("✅ New resources saved to /tmp/new-resources.json");

      return resources;
    } catch (parseError) {
      console.error("❌ Failed to parse JSON response:", parseError.message);
      console.error("Full response:", jsonResponse);
      console.error("Response preview:", jsonResponse.substring(0, 500));

      // Try to save the raw response for debugging
      try {
        const tmpDir = "/tmp";
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        fs.writeFileSync(path.join(tmpDir, "raw-response.txt"), jsonResponse);
        console.log(
          "🔍 Raw response saved to /tmp/raw-response.txt for debugging",
        );
      } catch (saveError) {
        console.error("Could not save raw response:", saveError.message);
      }

      throw new Error(`Invalid JSON generated: ${parseError.message}`);
    }
  } catch (error) {
    console.error("❌ Failed to generate resources:", error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log("🚀 Generate Resources Script\n");
  await generateResources();
  console.log("\n✨ Done!\n");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
