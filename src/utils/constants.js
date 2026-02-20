/**
 * Application constants and configuration
 */

// Default Gist configuration
export const GIST_CONFIG = {
  // Production gist URL
  // url: "https://gist.githubusercontent.com/JohnMichaelMiller/87014ff112bc5e218bcd52df21b860f8/raw/e46156400c9f84e894140a1ae27552460feb4705/resources.prod.json",

  // Test gist URL (currently deployed)
  url: "https://gist.githubusercontent.com/JohnMichaelMiller/a143ad703b899d9829f00e5c05a0ad82/raw/bfbb12bf8be3c0b69a653942e7f98b026c6e58fb/resources.test.json",

  // Alternative: Local test data (for development)
  // url: "./test-local.json",

  // Alternative: GitHub API (for more control)
  // apiUrl: 'https://api.github.com/gists/GIST_ID',
  // filename: 'resources.json'
};

// Risk area definitions for resource scoring
export const RISK_AREAS = [
  {
    key: "security_vulnerabilities",
    label: "SEC",
    tooltip:
      "Security Vulnerabilities: Threat modeling, SAST/DAST integration, vulnerability detection and mitigation strategies",
  },
  {
    key: "code_quality",
    label: "QUAL",
    tooltip:
      "Code Quality & Logic: Testing frameworks, validation pipelines, edge case handling, and quality assurance methodologies",
  },
  {
    key: "data_privacy",
    label: "PRIV",
    tooltip:
      "Data Privacy & Confidentiality: Data governance frameworks, compliance strategies, and sanitization techniques",
  },
  {
    key: "licensing_ip",
    label: "LIC",
    tooltip:
      "Licensing & IP Management: License compliance workflows, IP auditing processes, and legal risk assessment",
  },
  {
    key: "maintainability",
    label: "MAINT",
    tooltip:
      "Maintainability & Documentation: Traceability frameworks, documentation standards, and audit trail requirements",
  },
  {
    key: "bias_standards",
    label: "BIAS",
    tooltip:
      "Bias & Standards: Bias detection methodologies, code standards enforcement, and quality consistency",
  },
  {
    key: "over_reliance",
    label: "REL",
    tooltip:
      "Over-Reliance & Skills: Balanced AI usage frameworks, skill development programs, and independence strategies",
  },
];

// Default introduction text
export const DEFAULT_INTRODUCTION =
  "An AI curated collection of the most valuable resources for developers leveraging AI to generate, enhance, and optimize code. This list focuses on practical tools, techniques, and insights for integrating AI coding assistants into your development workflow.";

// Default legend HTML
export const DEFAULT_LEGEND = `
  <h3>🎯 Value-Based AI Coding Resource Scoring System</h3>
  <p>Each resource is evaluated on the specific AI coding risks it addresses, with individual scores from 1-100:</p>
  <div class="score-range excellent">
    <strong>90-100: Excellent</strong> - Top-tier resources with exceptional practical value
  </div>
  <div class="score-range solid">
    <strong>75-89: Solid</strong> - Useful resources with good practical application
  </div>
  <div class="score-range weaker">
    <strong>60-74: Weaker</strong> - Less practical or more theoretical resources
  </div>
  <h3>📊 Selection & Scoring Methodology:</h3>
  <ul>
    <li><strong>Security Vulnerabilities:</strong> Threat modeling, SAST/DAST integration, vulnerability detection</li>
    <li><strong>Code Quality & Logic:</strong> Testing frameworks, validation pipelines, edge case handling</li>
    <li><strong>Data Privacy & Confidentiality:</strong> Data governance, compliance frameworks, sanitization</li>
    <li><strong>Licensing & IP Management:</strong> License compliance, IP audit processes</li>
    <li><strong>Maintainability & Documentation:</strong> Traceability frameworks, documentation standards</li>
    <li><strong>Bias & Standards Consistency:</strong> Bias detection, style guide enforcement</li>
    <li><strong>Over-Reliance & Skill Development:</strong> Balanced AI usage, skill maintenance practices</li>
  </ul>
  <br>
  <p><em>Resources are selected based on their <strong>highest individual risk area score</strong>, ensuring best-in-class expertise. Overall scores represent averages across addressed risk areas only.</em></p>
`;
