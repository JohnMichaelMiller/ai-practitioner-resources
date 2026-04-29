# Test Environment Setup

This guide explains how to safely test gist automation scripts using a separate test gist without affecting the production environment.

## Overview

The project now supports two separate environments:

- **Production**: Uses `GIST_ID` and `GIST_TOKEN` (default)
- **Test**: Uses `TEST_GIST_ID` and `TEST_GIST_TOKEN` (when `TEST_MODE=true`)

## Quick Start

### 1. Create a Test Gist

1. Go to https://gist.github.com/
2. Create a new gist with:
   - **Filename**: `resources.json`
   - **Content**: Copy from your production gist or use `test-local.json` as a template
3. Click "Create public gist" (or secret if you prefer)
4. Copy the Gist ID from the URL
   - Example: `https://gist.github.com/username/abc123` → ID is `abc123`

### 2. Configure Environment Variables

Edit your `.env` file and add the test gist credentials:

```bash
# Production Gist (default)
GIST_ID=1a9d84d165a170d6f62cc052db97b8bb
GIST_TOKEN=ghp_your_production_token

# Test Gist (used when TEST_MODE=true)
TEST_GIST_ID=your_test_gist_id_here
TEST_GIST_TOKEN=ghp_your_test_token
```

**Note**: You can use the same GitHub token for both production and test, or create separate tokens for better isolation.

### 3. Run Test Commands

All test commands automatically use the test gist:

```bash
# Individual test commands
npm run test:fetch-current    # Fetch from test gist
npm run test:update-gist       # Update test gist only
npm run test:validate          # Validate test data

# Full test automation workflow
npm run test:run-automation    # Complete test workflow
```

## Production Commands

Production commands work as before (without `test:` prefix):

```bash
# Individual production commands
npm run fetch-current          # Fetch from production gist
npm run update-gist            # Update production gist
npm run validate               # Validate production data

# Full production automation workflow
npm run run-automation         # Complete production workflow
```

## Available Test Scripts

| Command                       | Description                            | Gist Used |
| ----------------------------- | -------------------------------------- | --------- |
| `npm run test:fetch-current`  | Fetch current resources from test gist | Test      |
| `npm run test:generate`       | Generate new resources (test mode)     | Test      |
| `npm run test:merge`          | Merge resources (test mode)            | Test      |
| `npm run test:validate`       | Validate schema (test mode)            | Test      |
| `npm run test:update-gist`    | Update test gist                       | Test      |
| `npm run test:create-summary` | Create summary for test run            | Test      |
| `npm run test:run-automation` | Run complete test automation           | Test      |

## Environment Indicators

Scripts will display which mode they're running in:

- **Test Mode**: `🧪 Running in TEST mode`
- **Production Mode**: `🚀 Running in PRODUCTION mode`

## Testing Workflow

### Safe Testing Process

1. **Start with test environment**:

   ```bash
   npm run test:fetch-current
   ```

2. **Make your changes** (edit scripts, schemas, etc.)

3. **Test the changes**:

   ```bash
   npm run test:update-gist
   ```

4. **Verify test gist** manually:
   - Check your test gist URL
   - Verify the changes look correct

5. **Run full test automation** (optional):

   ```bash
   npm run test:run-automation
   ```

6. **Deploy to production** when satisfied:
   ```bash
   npm run run-automation
   ```

### Rollback Strategy

If something goes wrong in production:

1. Check test gist to verify expected behavior
2. Review automation results in `/tmp/` directory
3. Fix issues and test again in test environment
4. Re-run production automation when ready

## File Locations

All automation scripts read/write to the same `/tmp/` directory regardless of mode:

- `/tmp/current-resources.json` - Fetched resources
- `/tmp/new-resources.json` - Generated resources
- `/tmp/merged-resources.json` - Merged output
- `/tmp/automation-summary.json` - Automation summary

**Note**: The files are the same for both test and production runs. This is intentional - only the gist source/destination changes.

## GitHub Actions

To add test mode support to GitHub Actions:

```yaml
# .github/workflows/test-automation.yml
- name: Run Test Automation
  env:
    TEST_MODE: true
    TEST_GIST_ID: ${{ secrets.TEST_GIST_ID }}
    TEST_GIST_TOKEN: ${{ secrets.TEST_GIST_TOKEN }}
  run: npm run test:run-automation
```

## Troubleshooting

### "GIST_TOKEN is required" Error

Make sure you've set the correct environment variables:

- Test mode needs: `TEST_GIST_ID` and `TEST_GIST_TOKEN`
- Production mode needs: `GIST_ID` and `GIST_TOKEN`

### Wrong Gist Being Updated

Check the console output for mode indicator:

- Should see `🧪 Running in TEST mode` for test commands
- Should see `🚀 Running in PRODUCTION mode` for production commands

### Can't Find Test Gist

Verify your `TEST_GIST_ID` is correct:

1. Go to your gist URL
2. The ID is the random string at the end
3. Example: `https://gist.github.com/username/abc123def456` → ID is `abc123def456`

## Best Practices

1. **Always test first**: Use `npm run test:*` commands before production
2. **Separate tokens**: Consider using different tokens for test vs production
3. **Regular backups**: Test gist is backed up with timestamps (like production)
4. **Verify manually**: Always check the gist URL after updates
5. **Document changes**: Use git commits to track what you're testing

## Security Notes

- `.env` file is gitignored - your tokens are safe
- Never commit tokens to the repository
- Rotate tokens periodically for security
- Test gist can be public or secret (your choice)
- Production gist should match your security requirements

## Additional Resources

- [GitHub Gist API Documentation](https://docs.github.com/en/rest/gists)
- [Creating Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Main README](README.md)
- [Scripts Documentation](scripts/README.md)
