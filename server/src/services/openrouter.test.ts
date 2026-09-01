import { describe, it, expect } from 'vitest';

import { generateQuestions } from './openrouter.service';

// In test environment the OPENROUTER_API_KEY env var is not set.
describe('openrouter service configuration guard', () => {
  it('throws a clear error when the API key is not configured', async () => {
    await expect(
      generateQuestions({ topicContext: 'Operating Systems', count: 10 })
    ).rejects.toThrow(/OPENROUTER_API_KEY/);
  });
});
