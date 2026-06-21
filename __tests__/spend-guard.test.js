import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @upstash/redis before importing the module under test.
// The real trackDailySpend function is called; only the external Redis boundary is mocked.
const mockIncrbyfloat = vi.fn();
const mockExpire = vi.fn();

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({
      incrbyfloat: mockIncrbyfloat,
      expire: mockExpire,
    }),
  },
}));

// We also need to mock the KeyManager (used at module load by openai.js) to avoid
// needing real GEMINI_API_KEYS — it's an external boundary.
vi.mock('../utils/key-manager.js', () => ({
  KeyManager: class {
    constructor() { this.keys = [null]; this.currentKeyIndex = 0; }
    getNextKey() { return null; }
  },
}));

// Suppress prompt-builder imports' side effects — they are external IP files, not the
// unit under test here; mock them at the boundary.
vi.mock('../prompts/analysis.js', () => ({ buildAnalysisPrompt: vi.fn() }));
vi.mock('../prompts/cv-generator.js', () => ({ buildCvPrompt: vi.fn() }));
vi.mock('../prompts/cover-letter.js', () => ({ buildCoverPrompt: vi.fn() }));

describe('trackDailySpend', () => {
  let trackDailySpend;
  let logger;

  beforeEach(async () => {
    vi.resetModules();
    mockIncrbyfloat.mockReset();
    mockExpire.mockReset();
    process.env.GEMINI_DAILY_BUDGET_USD = '10';
    // Re-import after resetting modules so the Redis singleton is fresh
    ({ trackDailySpend } = await import('../utils/openai.js'));
    ({ logger } = await import('../lib/logger.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls redis.expire with 26h TTL and does not log error when under budget', async () => {
    mockIncrbyfloat.mockResolvedValue(0.002);
    const spyError = vi.spyOn(logger, 'error');

    await trackDailySpend(0.002);

    expect(mockExpire).toHaveBeenCalledOnce();
    const [, ttl] = mockExpire.mock.calls[0];
    expect(ttl).toBe(60 * 60 * 26);
    expect(spyError).not.toHaveBeenCalled();
  });

  it('calls logger.error when daily total exceeds budget', async () => {
    mockIncrbyfloat.mockResolvedValue(11.5); // over $10
    const spyError = vi.spyOn(logger, 'error');

    await trackDailySpend(1.0);

    expect(spyError).toHaveBeenCalledOnce();
    const msg = spyError.mock.calls[0].join(' ');
    expect(msg).toMatch(/11\.5/);
    expect(msg).toMatch(/budget/i);
  });

  it('calls logger.warn and does not propagate when Redis throws', async () => {
    mockIncrbyfloat.mockRejectedValue(new Error('redis down'));
    const spyWarn = vi.spyOn(logger, 'warn');

    // Must not throw
    await expect(trackDailySpend(0.5)).resolves.toBeUndefined();
    expect(spyWarn).toHaveBeenCalledOnce();
    expect(spyWarn.mock.calls[0].join(' ')).toMatch(/redis down/i);
  });
});
