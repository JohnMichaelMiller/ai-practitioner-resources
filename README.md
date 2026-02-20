# 🤖 AI Practitioner Resources

A curated collection of the best AI-powered development resources, featuring an intelligent content generation system and beautiful web viewer for discovering books, articles, blogs, and podcasts about AI in software development.

## ✨ Features

- **📊 Intelligent Resource Curation**: AI-powered prompt system generates comprehensive resource lists
- **🎯 Risk-Based Scoring**: Resources evaluated on their ability to mitigate 7 principal AI coding risks
- **📱 Beautiful Web Interface**: Responsive design with filtering, statistics, and modern UI
- **🔄 Automated Updates**: Fully automated weekly resource generation and gist updates via GitHub Actions
- **🏷️ Rich Metadata**: Includes introduction, analysis, legends, and resource descriptions
- **⚡ Real-time Display**: Live updates from GitHub gists with no server required
- **📈 Smart Tracking**: Automatic weeks_on_list management with historical versioning

## 🚀 Quick Start

### Option 1: Use the Live Site

Visit the live viewer at: **https://j0hnnymiller.github.io/ai-practitioner-resources/**

### Option 2: Set Up Your Own

1. **Fork this repository**
2. **Create a GitHub Gist** with your resources JSON file
3. **Update the configuration** in `index.html`:
   ```javascript
   const GIST_CONFIG = {
     url: "https://gist.githubusercontent.com/yourusername/gistid/raw/resources.json",
   };
   ```
4. **Enable GitHub Pages** in your repository settings

## 📋 Project Structure

```
ai-practitioner-resources/
├── index.html                          # Main web viewer
├── resources.schema.json                         # JSON schema for validation
├── package.json                        # Node.js dependencies
├── .github/
│   ├── workflows/
│   │   └── weekly-ai-resources-update.yml  # Automated weekly updates
│   └── prompts/
│       └── ai-practitioner-resources-json.prompt.md  # AI generation prompt
├── scripts/
│   ├── fetch-current-resources.js     # Fetch existing resources from gist
│   ├── generate-resources.js          # Generate new resources via AI
│   ├── merge-and-update.js            # Merge and update weeks_on_list
│   ├── validate-schema.js             # Validate JSON against schema
│   ├── update-gist.js                 # Update gist with new resources
│   └── create-summary.js              # Generate automation summary
└── README.md                          # This file
```

## 🤖 Automated Weekly Updates

This project features **fully automated weekly resource generation** using GitHub Actions:

### How It Works

1. **Every Monday at 9 AM UTC**, the automation workflow runs automatically
2. **Fetches current resources** from your GitHub Gist
3. **Generates new resources** using OpenAI GPT-4 and the project prompt
4. **Intelligently merges** new and existing resources, tracking weeks_on_list
5. **Validates** the generated JSON against the schema
6. **Updates the gist** with both current and timestamped archive versions
7. **Creates a summary** with statistics and insights

### Required GitHub Secrets

To enable automation, configure these secrets in your repository:

- `OPENAI_API_KEY` - Your OpenAI API key for GPT-4 access
- `GITHUB_GIST_TOKEN` - Personal access token with **gist** scope (read and write permissions for gists)
- `GIST_ID` - The ID of your target GitHub Gist

📖 **Detailed Setup Guide:** See [docs/AUTOMATION_SETUP.md](docs/AUTOMATION_SETUP.md) for step-by-step instructions.

### Manual Triggering

You can manually trigger the workflow anytime:

1. Go to the **Actions** tab in your repository
2. Select **Weekly AI Resources Update**
3. Click **Run workflow**

### Scripts Usage

You can also run the automation scripts locally:

```bash
# Install dependencies
npm install

# Run individual scripts
npm run fetch-current    # Fetch current resources from gist
npm run generate          # Generate new resources with AI
npm run merge             # Merge and update weeks_on_list
npm run validate          # Validate against schema
npm run update-gist       # Update the gist

# Or run the complete automation
npm run run-automation
```

**Note:** Local execution requires the same environment variables as the GitHub Action.

**🧪 Testing:** Use test commands to safely test changes without affecting production:

```bash
npm run test:update-gist       # Update test gist only
npm run test:run-automation    # Full test workflow
```

See [TEST_QUICK_REFERENCE.md](TEST_QUICK_REFERENCE.md) for details.

## 🤖 AI Content Generation

This project includes an intelligent prompt system for generating high-quality resource lists.

### Automated Generation (Recommended)

The **Weekly AI Resources Update** workflow automatically generates new resources every Monday using OpenAI GPT-4. No manual intervention required!

### Manual Generation

For manual or one-time generation, use the prompt in `.github/prompts/ai-practitioner-resources-json.prompt.md` with any AI assistant to generate content that matches the schema.

### Schema Structure

Resources follow this comprehensive schema:

```json
{
  "introduction": "Brief explanation of the list's purpose...",
  "resources": [
    {
      "type": "Book|Article|Blog|Podcast",
      "title": "Resource Title",
      "source": "https://example.com",
      "score": 95,
      "weeks_on_list": 1,
      "blurb": "Brief description of the resource's value..."
    }
  ],
  "legend": "<div>HTML scoring system legend</div>",
  "analysis": "Analysis of trends with <strong>HTML</strong> formatting"
}
```

### Risk-Based Scoring Framework

Resources are evaluated based on their ability to address the **7 Principal Risks of AI-Assisted Coding**:

1. **Security Vulnerabilities** - Design flaws and known vulnerabilities in AI-generated code
2. **Logic & Quality Issues** - Semantically flawed code and inadequate error handling
3. **Data Leakage & Confidentiality** - Unintended exposure of proprietary or sensitive data
4. **Licensing & IP Concerns** - Accidental introduction of restrictive-licensed code
5. **Maintainability & Traceability** - Hard-to-explain "black box" code with poor documentation
6. **Bias & Inconsistent Standards** - Outdated patterns, insecure defaults, style inconsistencies
7. **Over-Reliance & Skill Atrophy** - Excessive dependency reducing debugging abilities

Each resource is scored 60-100 on individual risk areas it addresses, or marked "not_covered". Resources are selected based on their **highest individual risk area score**, ensuring practical risk mitigation value.

## 🎨 Web Viewer Features

- **📱 Responsive Design**: Perfect on desktop, tablet, and mobile
- **🔍 Smart Filtering**: Filter by resource type with counts
- **📊 Live Statistics**: Total resources, types, average scores
- **🏆 Risk-Based Sorting**: Resources ordered by highest risk mitigation score
- **🆕 New Resource Badges**: Highlights recently added items
- **📝 Rich Descriptions**: Blurbs provide context before clicking
- **📈 Visual Analysis**: Trend insights in styled sections
- **🎯 Modern UI**: Beautiful gradients and hover animations
- **⚡ Fast Loading**: Efficient GitHub gist integration

## 🔧 Customization

### Styling the Interface

Modify the CSS in `styles.css` to customize:

- Color schemes and gradients
- Typography and fonts
- Layout and spacing
- Animation effects

The UI is built with modular JavaScript in `src/` and a standalone stylesheet `styles.css` for clarity and easier maintenance.

### Content Sections

The viewer renders four main sections:

1. **Introduction** - Purpose and context
2. **Resources Grid** - Filterable, sortable resource cards
3. **Legend** - Scoring system with HTML formatting
4. **Analysis** - Weekly insights with numbered points

### Adding Resource Types

New resource types automatically receive:

- Dedicated filter buttons with counts
- Color-coded type badges
- Integrated statistics

## 🔄 Content Management

### Automated Updates

- **External Scripts**: Manage `weeks_on_list` values automatically
- **Version Control**: Track resource longevity and trends
- **Gist Integration**: Update JSON file to refresh live site instantly

### Manual Updates

1. Generate new content using the AI prompt
2. Update your GitHub gist with the new JSON
3. Site refreshes automatically with latest data

## 🛠️ Advanced Setup

### GitHub API Configuration

For enhanced control, use the GitHub API:

```javascript
const GIST_CONFIG = {
  apiUrl: "https://api.github.com/gists/your-gist-id",
  filename: "resources.json",
};
```

### Schema Validation

Validate your JSON against `resources.schema.json` to ensure compatibility:

- All required fields present
- Correct data types and formats
- HTML formatting in text fields
- Valid URLs and score ranges

### Development Workflow

1. **Generate Content**: Use AI prompt to create resource list
2. **Validate**: Check against JSON schema
3. **Test Locally**: Open `index.html` in browser
4. **Deploy**: Update gist and push to GitHub Pages

## 📊 Analytics & Insights

The analysis section provides:

- **Trend Identification**: Spot patterns in resource types
- **Quality Assessment**: Score distribution analysis
- **Content Evolution**: Track changes over time
- **User Guidance**: Help users find relevant resources

## 📋 Issue Templates & Project Planning

This repository includes 10 comprehensive issue templates for planned enhancements:

- Testing framework implementation (Jest + Playwright)
- GitHub footer link addition
- Automated AI resource generation
- Gradual fade effects for NEW tags
- Private gist impact investigation
- Local development environment support
- Analysis ordering improvements
- Content bias removal
- And more...

### Creating Issues from Templates

You can automatically create GitHub issues from all templates using one of these methods:

**Method 1: GitHub Actions (Recommended)**

1. Go to **Actions** tab → **Create Issues from Templates** workflow
2. Click **Run workflow**
3. Choose dry run mode to preview, or run to create issues

**Method 2: Script Execution**

```bash
GITHUB_TOKEN=your_token node scripts/create-issues-from-templates.js
```

**Method 3: Manual via GitHub UI**
Create each issue manually from the template chooser.

📖 **Full Documentation**: See [docs/CREATE_ISSUES.md](docs/CREATE_ISSUES.md) for detailed instructions.

## 🤝 Contributing

**Important:** This project uses a unique AI-first contribution process. Please read our [Contributors Guide](CONTRIBUTORS.md) for details.

**TL;DR:** We don't accept traditional pull requests. Instead:

1. Create an issue with a detailed prompt describing your idea
2. After review, approved issues are assigned to GitHub Copilot for implementation
3. Want to review code and prompts? Request contributor access via issue

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for the complete contribution process.

## 📄 License

This project is open source. Feel free to use, modify, and distribute.

---

**🚀 Ready to curate the best AI development resources!** Visit the live site or deploy your own version today! 🎉
