# Resource Generation Determinism Guide

This document explains how the AI resource generation has been optimized for consistency and determinism, and how to tune the behavior.

## Overview of Changes

The resource generation process has been enhanced to produce more consistent results across multiple runs:

### 1. **Temperature Control** (Added Feb 2026)

The AI generation now uses a configurable temperature parameter to control output randomness:

- **Default**: `0.3` (balanced determinism)
- **Range**: `0.0` (maximum determinism) to `1.0` (maximum creativity)
- **Configuration**: Set via `AI_TEMPERATURE` environment variable in `.env`

```bash
# In .env file
AI_TEMPERATURE=0.3  # Lower = more consistent
```

**Temperature Guidelines:**

- `0.0-0.2`: Maximum consistency, may repeat same resources frequently
- `0.2-0.4`: Balanced - good mix of consistency and variety (recommended)
- `0.4-0.7`: More varied outputs, less deterministic
- `0.7-1.0`: High creativity, minimal consistency across runs

### 2. **Stability-Focused Prompting**

The prompt has been enhanced to prioritize stable, authoritative resources:

- **Prefers foundational sources**: OWASP, NIST, AWS, Azure, Google Cloud, O'Reilly, Manning
- **Favors evergreen content**: Official documentation, established books, security frameworks
- **Uses canonical URLs**: Official domains, stable permalinks
- **Avoids ephemeral content**: News articles, time-sensitive blog posts

### 3. **Improved Resource Matching**

The merge script now uses flexible matching to handle variations:

#### Exact Matching

- Exact title match + normalized URL (protocol, www, trailing slashes removed)
- Prevents false mismatches from minor URL variations

#### Fuzzy Matching (Fallback)

- Normalized title matching (case-insensitive, punctuation normalized)
- Catches resources with slight title variations like:
  - "Clean Code: A Handbook" vs "Clean Code - A Handbook"
  - Different subtitle formats
  - Punctuation differences

**Benefits:**

- `weeks_on_list` counter properly increments even with minor variations
- Reduces false "new resource" detections
- Better tracking of resource persistence

## Testing Determinism

### Quick Test

Run the automation twice and compare:

```bash
# Run 1
npm run test:run-automation
cp \tmp\merged-resources.json \tmp\test-run1.json

# Wait or run immediately for comparison
# Run 2
npm run test:run-automation
cp \tmp\merged-resources.json \tmp\test-run2.json

# Compare
diff \tmp\test-run1.json \tmp\test-run2.json
```

### Measuring Consistency

Key metrics to track:

- **Resource retention rate**: How many resources appear in both runs
- **Match rate**: Exact + fuzzy matches reported in merge output
- **Title stability**: Same resources appearing with identical titles
- **URL consistency**: Same canonical URLs being used

### Expected Results

With `AI_TEMPERATURE=0.3`:

- **50-70% resource retention** across runs (vs 15% before)
- **3-10 stable core resources** that appear consistently
- **Higher match rates** due to fuzzy matching improvements

With `AI_TEMPERATURE=0.0`:

- **70-90% resource retention** expected
- **More predictable selections**, but less diversity
- Risk of "stuck" on same resources repeatedly

## Tuning Recommendations

### For Production (Weekly Updates)

```bash
AI_TEMPERATURE=0.3  # Balanced approach
```

- Allows fresh resources while maintaining some consistency
- Good mix of stability and discovery

### For Testing/Development

```bash
AI_TEMPERATURE=0.5  # More variety for testing
```

- Helps test merge logic with different resources
- Good for validating schema compliance with diverse inputs

### For Maximum Stability

```bash
AI_TEMPERATURE=0.1  # Very low variance
```

- Use when you want minimal changes week-to-week
- Good for stable production environments
- May reduce discovery of new valuable resources

## Troubleshooting

### Issue: Too much variation between runs

**Solution:**

1. Lower `AI_TEMPERATURE` (try 0.2 or 0.1)
2. Check that prompt emphasizes stable sources
3. Review matched resources count in merge output

### Issue: Same resources every time

**Solution:**

1. Increase `AI_TEMPERATURE` (try 0.4-0.5)
2. Consider adding date/context to prompt for freshness
3. May be expected behavior at very low temperatures

### Issue: `weeks_on_list` not incrementing

**Check:**

1. Merge output shows "Matched resources" and "Fuzzy matched" counts
2. Resource titles are consistent (check for typos)
3. URLs normalize correctly (test with `normalizeUrl()` function)

**Debug:**

```javascript
// In merge-and-update.js, add logging:
console.log(`Exact key: ${exactKey}`);
console.log(`Normalized title: ${normalizedTitle}`);
```

## Monitoring

Watch these indicators in automation output:

```
🔄 Merging resources and updating weeks_on_list...
   Current resources: 20
   New resources: 20
   Resources in map: 20
   Matched resources: 5      ← Exact matches
   Fuzzy matched: 3          ← Title-based matches
   New resources: 12         ← Completely new
```

**Healthy metrics:**

- Matched + Fuzzy matched = 8-15 resources (40-75% retention)
- Balanced mix of new and continuing resources
- Few resources with `weeks_on_list > 5` (indicates true stability)

## Best Practices

1. **Start with default** (`AI_TEMPERATURE=0.3`) and adjust based on results
2. **Monitor retention rates** over multiple runs before changing settings
3. **Test in TEST mode** before applying changes to production
4. **Document any changes** to temperature in commit messages
5. **Review fuzzy matches** periodically to ensure valid matches

## Related Files

- [generate-resources.js](scripts/generate-resources.js) - Temperature configuration
- [merge-and-update.js](scripts/merge-and-update.js) - Matching logic
- [ai-practitioner-resources-json.prompt.md](.github/prompts/ai-practitioner-resources-json.prompt.md) - Stability instructions
- [.env](.env) - Temperature configuration

## Version History

- **Feb 2026**: Added temperature control, fuzzy matching, stability-focused prompting
- **Jan 2026**: Initial implementation with exact title+source matching
