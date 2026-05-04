# Dual-Project Workflow Testing Setup Guide

This guide explains how to set up isolated workflow testing using GitHub Projects V2.

## Overview

The dual-project architecture separates production work from workflow testing:

- **Production Project**: Real work, managed by production workflows
- **Test Project**: Workflow testing, runs same workflows in isolation

## Prerequisites

1. GitHub token with `repo` and `project` scopes
2. Two GitHub Projects created in your repository

## Step 1: Create GitHub Projects

GitHub Projects V2 are created at the **user level**, not the repository level. Navigate to https://github.com/new/project to create a new project.

- All projects: https://github.com/JohnMichaelMiller?tab=projects
- Production project (#1): https://github.com/users/JohnMichaelMiller/projects/1

### Create Production Project (if not exists)

```powershell
$projects = gh project list --owner JohnMichaelMiller --format json | ConvertFrom-Json
if (-not ($projects.projects | Where-Object { $_.title -eq 'AI Practitioner Resources' })) {
    gh project create --owner JohnMichaelMiller --title "AI Practitioner Resources"
} else {
    Write-Host "Project 'AI Practitioner Resources' already exists."
}
```

Note the project number from the output URL (e.g., `#1`).

### Create Test Project

```powershell
$projects = gh project list --owner JohnMichaelMiller --format json | ConvertFrom-Json
if (-not ($projects.projects | Where-Object { $_.title -eq 'Workflow Testing' })) {
    gh project create --owner JohnMichaelMiller --title "Workflow Testing"
} else {
    Write-Host "Project 'Workflow Testing' already exists."
}
```

Note the project number from the output URL (e.g., `#2`).

## Step 2: Configure Environment Variables

### For Test Workflows

Set these when running test scripts:

```bash
export GITHUB_TOKEN=ghp_your_token_here
export TEST_PROJECT_NUMBER=1  # The test project number
export GITHUB_REPOSITORY=JohnMichaelMiller/ai-practitioner-resources
```

### For Production Workflows

In your `.github/workflows/*.yml` files, add:

```yaml
env:
  PROJECT_ID: ${{ vars.PRODUCTION_PROJECT_ID }}
```

Then set the repository variable:

```bash
gh variable set PRODUCTION_PROJECT_ID --body "PVT_..." # Get from GraphQL
```

## Step 3: Get Project IDs

Project IDs are needed for GraphQL operations. Run this to get them:

```bash
# Get test project ID
node -e "
const { getProjectId } = require('./scripts/lib/graphql-helpers');
(async () => {
  const project = await getProjectId('JohnMichaelMiller', 1, process.env.GITHUB_TOKEN);
  console.log('Test Project ID:', project.id);
})();
"

# Get production project ID
node -e "
const { getProjectId } = require('./scripts/lib/graphql-helpers');
(async () => {
  const project = await getProjectId('JohnMichaelMiller', 2, process.env.GITHUB_TOKEN);
  console.log('Production Project ID:', project.id);
})();
"
```

Save these IDs - you'll need them for workflow configuration.

## Step 4: Create Your First Test Issue

```bash
# Set environment variables
export GITHUB_TOKEN=your_token
export TEST_PROJECT_NUMBER=1

# Create a single test issue
ISSUE_FILE=feature-add-dark-mode.md node scripts/create-test-issues.js
```

The issue will be:

1. Created in the repository
2. Automatically added to the Test Project
3. Isolated from production workflows

## Step 5: Verify Isolation

Check that the test issue:

1. ✅ Appears in the Test Project board
2. ✅ Does NOT appear in the Production Project
3. ✅ Has appropriate labels (feature, bug, etc.)
4. ✅ Does NOT affect production lane counts

## Step 6: Run Workflow Tests

Once test issues are in the Test Project, they will go through the same workflows as production issues, but completely isolated:

- Intake workflow adds `on the bench` and `needs-triage` labels
- PM review workflow evaluates and approves/rejects
- Rebalancing pulls from test project only (when configured)

## Step 7: Cleanup After Testing

```bash
# Close all test issues
GITHUB_TOKEN=your_token node scripts/cleanup-test-issues.js
```

Or manually:

1. Go to the Test Project
2. Close all issues
3. Archive or delete the project if done testing

## Next Steps: Making Workflows Project-Aware

The following scripts need to be modified to filter by project:

1. `scripts/rebalance-lanes.js` - Only rebalance within one project
2. `scripts/pm-review.js` - Only review issues in target project
3. `scripts/issue-intake.js` - May need project assignment logic

See `PROJECT_AWARENESS_MIGRATION.md` for detailed migration steps.

## Troubleshooting

### Error: "Could not find test project"

- Verify the project number is correct
- Check that your token has `project` scope
- Ensure you have access to the project

### Error: "INSUFFICIENT_SCOPES"

Your token needs both `repo` and `project` scopes. Regenerate your token with:

- ✅ `repo` (Full control of private repositories)
- ✅ `project` (Full control of projects)

### Test issues appearing in production

- Workflows are not yet project-aware
- Follow the migration guide to update scripts
- For now, manually move issues between projects

## Reference

- GraphQL helpers: `scripts/lib/graphql-helpers.js`
- Test issue creator: `scripts/create-test-issues.js`
- Cleanup script: `scripts/cleanup-test-issues.js`
