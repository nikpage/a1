import { describe, test, expect, beforeEach, vi } from 'vitest';

// Hoisted mock functions — must be declared before vi.mock() hoisting resolves
const mockInsert = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ insert: mockInsert }),
  }),
}));

import { logAiTransaction } from './database.js';

beforeEach(() => {
  mockInsert.mockReset();
});

describe('logAiTransaction — AI cost math', () => {
  test('inserts correct row with exact amount_usd', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    await logAiTransaction({
      user_id: 'u123',
      model: 'gemini-3.5-flash',
      cache_miss_tokens: 1000,
      cache_hit_tokens: 0,
      completion_tokens: 500,
      thinking_tokens: 100,
      detail: { type: 'cv' },
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    const row = mockInsert.mock.calls[0][0][0];

    // Money math at $1.50/1M input, $9.00/1M output:
    // 1000×0.0000015 + 500×0.000009 = 0.006
    expect(row.amount_usd).toBe('0.006000000000');
    expect(row.user_id).toBe('u123');
    expect(row.type).toBe('ai_cost');
    expect(row.model).toBe('gemini-3.5-flash');
    expect(row.completion_tokens).toBe(500);
    expect(row.thinking_tokens).toBe(100);
    expect(row.cache_miss_tokens).toBe(1000);
  });

  // The models that were live on 2026-08-15 and absent from the model_pricing
  // TABLE. Under the old lookup every one of these calls billed at Google and
  // inserted nothing at all.
  test.each([
    ['gemini-3.6-flash',      1000, 500, '0.002625000000'], // 1000×0.00000075 + 500×0.00000375
    ['gemini-3.5-flash-lite', 1000, 500, '0.001550000000'], // 1000×0.0000003  + 500×0.0000025
  ])('prices %s, which the pricing table never had', async (model, inTok, outTok, expected) => {
    mockInsert.mockResolvedValueOnce({ error: null });

    await logAiTransaction({
      user_id: 'u123',
      model,
      cache_miss_tokens: inTok,
      completion_tokens: outTok,
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockInsert.mock.calls[0][0][0].amount_usd).toBe(expected);
  });

  // Regression: the old code returned WITHOUT inserting when it could not find
  // a price, so an unpriced call left no trace anywhere. The row must land.
  test('still inserts the row when the model has no recorded rate', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    await logAiTransaction({
      user_id: 'u123',
      model: 'gemini-99-unknown',
      cache_miss_tokens: 1000,
      completion_tokens: 500,
      thinking_tokens: 200,
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    const row = mockInsert.mock.calls[0][0][0];
    expect(row.amount_usd).toBeNull();       // unknown price, never a silent zero
    expect(row.model).toBe('gemini-99-unknown');
    expect(row.cache_miss_tokens).toBe(1000);
    expect(row.completion_tokens).toBe(500);
    expect(row.thinking_tokens).toBe(200);
  });
});
