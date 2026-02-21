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

  try {
    console.log("⏳ Calling Anthropic Claude API (this may take a minute)...");
    console.log(`   Temperature: ${TEMPERATURE} (${TEMPERATURE < 0.5 ? 'high determinism' : 'balanced'})`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10000,
        temperature: TEMPERATURE,
        messages: [
          {
            role: "user",
            content: `You are an expert AI researcher who curates high-quality resources for developers. Generate ONLY valid JSON with no additional text.

IMPORTANT CONSISTENCY REQUIREMENTS:
1) Prefer STABLE, WELL-KNOWN resources from authoritative sources (OWASP, NIST, Microsoft, AWS, Google, O'Reilly, Manning, Pragmatic Programmers)
2) Use REAL, ACTUAL resources with genuine, canonical URLs (never use example.com or placeholder links)
3) Favor resources that are likely to persist across multiple runs (official documentation, established books, major security frameworks)
4) Include 15-25 diverse resources, prioritizing foundational/evergreen content over trendy ephemeral articles
5) Ensure all property names and string values are properly quoted with double quotes
6) Use consistent URL formats (prefer official domains and stable permalinks)

${promptContent}`,
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
