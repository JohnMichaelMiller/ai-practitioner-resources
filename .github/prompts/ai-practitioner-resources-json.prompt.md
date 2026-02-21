Generate a comprehensive list of resources that help developers safely integrate AI coding assistants while mitigating principal risks. Output the results as a JSON object that conforms to the AI Practitioner Resources schema.

**CRITICAL CONSISTENCY REQUIREMENTS:**
- **Prioritize STABLE, AUTHORITATIVE resources** that are likely to persist across multiple generation runs
- **Prefer foundational sources**: Official security frameworks (OWASP, NIST), major cloud providers (AWS, Azure, Google), established publishers (O'Reilly, Manning), respected industry blogs (Martin Fowler, ThoughtWorks)
- **Use canonical URLs**: Official documentation sites, publisher websites, stable permalink formats
- **Favor evergreen content** over time-sensitive news articles or blog posts
- Use only REAL, EXISTING resources with genuine URLs. Never use placeholder domains like example.com or fictional resources

## Risk-Based Content Focus

Resources should address one or more of these **7 Principal Risks of AI-Assisted Coding**:

1. **Security Vulnerabilities** - AI-generated code containing design flaws or known vulnerabilities
2. **Logic & Quality Issues** - Syntactically correct but semantically flawed code, lack of error handling
3. **Data Leakage & Confidentiality** - Unintended exposure of proprietary code or sensitive data
4. **Licensing & IP Concerns** - Accidentally introducing restrictive-licensed code snippets
5. **Maintainability & Traceability** - Hard-to-explain "black box" code, poor documentation
6. **Bias & Inconsistent Standards** - Outdated patterns, insecure defaults, style inconsistencies
7. **Over-Reliance & Skill Atrophy** - Excessive dependency reducing debugging and reasoning abilities

## Scoring Framework

**Evaluate each resource on ONLY the risk areas it actually addresses (minimum: mentions + actionable guidance).**

**INCLUSION CRITERIA: Resources are selected based on their HIGHEST individual risk area score. Any score below 60 in a risk area should be marked as "not_covered".**

### Individual Risk Area Scoring (1-100 scale for coverage):

**Security Vulnerability Mitigation:**

- 90-100: Comprehensive security workflows, SAST/DAST integration, threat modeling examples
- 75-89: Detailed security practices, vulnerability examples, specific mitigation strategies
- 60-74: Basic security considerations with at least one actionable mitigation strategy
- Below 60: Resource does not adequately address security (mark as "not_covered")

**Code Quality & Logic Validation:**

- 90-100: Complete testing frameworks, edge case handling, validation pipelines
- 75-89: Solid testing practices, code review processes, quality metrics
- 60-74: Basic testing recommendations with at least one actionable validation step
- Below 60: Resource does not adequately address code quality (mark as "not_covered")

**Data Privacy & Confidentiality:**

- 90-100: Comprehensive data governance, compliance frameworks, sanitization techniques
- 75-89: Clear privacy policies, data handling best practices, risk assessment
- 60-74: Basic privacy considerations with at least one actionable protection measure
- Below 60: Resource does not adequately address data privacy (mark as "not_covered")

**Licensing & IP Risk Management:**

- 90-100: Complete compliance workflows, license scanning tools, IP audit processes
- 75-89: Clear licensing guidance, compliance checking, legal risk awareness
- 60-74: Basic license awareness with at least one actionable compliance step
- Below 60: Resource does not adequately address licensing/IP (mark as "not_covered")

**Maintainability & Documentation:**

- 90-100: Complete traceability frameworks, documentation standards, audit trails
- 75-89: Solid documentation practices, code annotation strategies
- 60-74: Basic documentation recommendations with at least one actionable practice
- Below 60: Resource does not adequately address maintainability (mark as "not_covered")

**Bias & Standards Consistency:**

- 90-100: Comprehensive bias detection, style guide enforcement, quality standards
- 75-89: Clear bias awareness, code standard practices
- 60-74: Basic bias considerations with at least one actionable mitigation approach
- Below 60: Resource does not adequately address bias/standards (mark as "not_covered")

**Over-Reliance & Skill Development:**

- 90-100: Balanced AI usage frameworks, skill development programs, independence strategies
- 75-89: Clear guidance on AI limitations, skill maintenance practices
- 60-74: Basic over-reliance awareness with at least one actionable recommendation
- Below 60: Resource does not adequately address over-reliance (mark as "not_covered")

## Resource Selection Strategy

**Selection Method**: Resources are chosen based on their **HIGHEST individual risk area score**. This ensures practical risk mitigation value over generic advice.

**Coverage Breadth**: After selecting the top 20 resources by highest scores, calculate coverage breadth as the percentage of the 7 risk areas where at least one resource scores 75+ (indicating solid coverage).

Focus on resources that cover:

- Secure AI-assisted development practices
- Code review and validation techniques
- Privacy-preserving development workflows
- Compliance and licensing management
- Maintainable AI-generated code practices
- Bias detection and mitigation
- Balanced AI tool usage strategies

## Required JSON Structure

The output must be a JSON object with these four required properties:

1. **introduction**: A comprehensive string (150-250 words) that:

   - Explains the purpose: helping developers safely integrate AI coding assistants
   - Highlights the risk-mitigation focus and why it matters
   - References the 7 Principal Risks framework as the organizational structure
   - Mentions the scoring methodology (1-100 scale, selection by highest individual scores)
   - Sets expectations about resource quality and practical applicability
   - Uses HTML formatting with proper `<p>`, `<strong>`, and `<em>` tags
   - Maintains a professional, authoritative tone suitable for practitioners
   - **IMPORTANT**: Do not use the word "curated" in the introduction text

2. **resources**: An array of resource objects, each containing:
   - **type**: Must be one of: "Book", "Article", "Blog", "Podcast"
   - **title**: The full title of the resource
   - **source**: A REAL, working URL to the actual resource
   - **risk_coverage**: An object with scores (1-100) or "not_covered" for each risk area:
     - **security_vulnerabilities**: Score for security vulnerability mitigation coverage
     - **code_quality**: Score for logic validation and quality assurance coverage
     - **data_privacy**: Score for data privacy and confidentiality protection coverage
     - **licensing_ip**: Score for licensing and intellectual property risk management coverage
     - **maintainability**: Score for maintainability and documentation practices coverage
     - **bias_standards**: Score for bias detection and coding standards coverage
     - **over_reliance**: Score for preventing over-reliance and maintaining skills coverage
   - **overall_score**: Integer 1-100 representing the resource's general usefulness
   - **highest_score**: Integer representing the highest individual risk area score (this is the selection criterion)
   - **coverage_breadth**: Integer 0-7 indicating how many risk areas this resource addresses with scores ≥60
   - **weeks_on_list**: Set to 1 for all new resources (external script will manage this)
   - **blurb**: A concise 1-2 sentence description explaining what risk mitigation value the resource provides
3. **legend**: A string containing HTML markup explaining the risk-based scoring system
4. **analysis**: A string containing analysis of risk coverage patterns and mitigation gaps

## Example Risk Coverage Object:

```json
"risk_coverage": {
  "security_vulnerabilities": 85,
  "code_quality": 75,
  "data_privacy": "not_covered",
  "licensing_ip": 90,
  "maintainability": 70,
  "bias_standards": "not_covered",
  "over_reliance": 65
}
```

## Important Formatting Requirements:

- **Use HTML formatting, NOT Markdown**: All text content should use HTML tags instead of Markdown syntax
- **Bold text**: Use `<strong>` tags instead of `**bold**`
- **Emphasis**: Use `<em>` tags instead of `*italic*`
- **Lists**: Use `<ul>` and `<li>` tags instead of `-` or `*`
- **Headers**: Use `<h4>`, `<h5>` etc. instead of `####`
- **Code**: Use `<code>` tags instead of backticks

## Output Requirements:

- Generate a single, valid JSON object conforming to the updated schema
- All four properties (introduction, resources, legend, analysis) must be present
- The resources array should contain exactly 20 high-quality resources
- Resources are selected based on their **highest individual risk area score**
- Calculate coverage_breadth after selection (count of risk areas with ≥75 coverage across all resources)
- HTML in legend and analysis should be properly escaped for JSON
- **Analysis should focus on risk coverage patterns** and identify any mitigation gaps
- **All text fields must use HTML formatting** with proper tags and structure
- **No Markdown syntax** should be used in any text fields

The JSON output must be valid and conform exactly to the updated AI Practitioner Resources schema with risk_coverage structure.
