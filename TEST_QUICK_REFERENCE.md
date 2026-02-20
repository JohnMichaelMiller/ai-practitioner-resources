# Test vs Production - Quick Reference

## 🧪 Test Commands (Safe - Won't affect production)

```bash
# Update test gist only
npm run test:update-gist

# Fetch from test gist
npm run test:fetch-current

# Run full test automation
npm run test:run-automation
```

## 🚀 Production Commands (Updates live site)

```bash
# Update production gist
npm run update-gist

# Fetch from production gist
npm run fetch-current

# Run full production automation
npm run run-automation
```

## ⚙️ Setup (One-time)

1. **Create test gist**: https://gist.github.com/
2. **Add to `.env`**:
   ```bash
   TEST_GIST_ID=your_test_gist_id_here
   TEST_GIST_TOKEN=your_github_token
   ```
3. **Test it**: `npm run test:update-gist`

## 🎯 Safe Testing Workflow

1. `npm run test:update-gist` → Test changes
2. Check test gist URL → Verify it worked
3. `npm run update-gist` → Deploy to production

## 📚 Full Guide

See [TEST_ENVIRONMENT_SETUP.md](TEST_ENVIRONMENT_SETUP.md) for complete documentation.
