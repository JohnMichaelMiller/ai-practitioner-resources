import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { assessIssueDetails } = require('../scripts/issue-intake.js');

describe('scripts/issue-intake.assessIssueDetails', () => {
  test('fails when body is empty', () => {
    const result = assessIssueDetails('');
    expect(result.passed).toBe(false);
    expect(result.hasBody).toBe(false);
  });

  test('fails when body is too short', () => {
    const result = assessIssueDetails('## Summary\n\n- [ ] short');
    expect(result.passed).toBe(false);
    expect(result.hasMinLength).toBe(false);
  });

  test('fails when body has no heading or checkbox', () => {
    const result = assessIssueDetails(
      'This issue body is longer than fifty characters but has no markdown structure.'
    );
    expect(result.passed).toBe(false);
    expect(result.hasStructuredContent).toBe(false);
  });

  test('passes when body meets all intake requirements', () => {
    const result = assessIssueDetails(
      '## Summary\n\nThis issue includes enough detail to exceed fifty characters.\n\n- [ ] Acceptance criteria item'
    );
    expect(result.passed).toBe(true);
  });
});
