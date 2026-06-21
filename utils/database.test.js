import { describe, test, expect, beforeEach, vi } from 'vitest';

// Hoisted mock functions — must be declared before vi.mock() hoisting resolves
const mockPricingEq = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table) => {
      if (table === 'model_pricing') {
        return { select: () => ({ eq: mockPricingEq }) };
      }
      return { insert: mockInsert };
    },
  }),
}));

import { logAiTransaction } from './database.js';

// USD per token as specified by the test instruction
const PRICING_ROWS = [
  { event_type: 'cache_miss', cost_per_call: '0.0000015' },
  { event_type: 'cache_hit',  cost_per_call: '0.00000015' },
  { event_type: 'completion', cost_per_call: '0.000009' },
];

beforeEach(() => {
  mockPricingEq.mockReset();
  mockInsert.mockReset();
});

describe('logAiTransaction — AI cost math', () => {
  test('inserts correct row with exact amount_usd', async () => {
    mockPricingEq.mockResolvedValueOnce({ data: PRICING_ROWS, error: null });
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

    // Money math: 1000×0.0000015 + 0×0.00000015 + 500×0.000009 = 0.006
    expect(row.amount_usd).toBe('0.006000000000');
    expect(row.user_id).toBe('u123');
    expect(row.type).toBe('ai_cost');
    expect(row.model).toBe('gemini-3.5-flash');
    expect(row.completion_tokens).toBe(500);
    expect(row.thinking_tokens).toBe(100);
    expect(row.cache_miss_tokens).toBe(1000);
  });

  test('bails without inserting when pricing lookup returns empty array', async () => {
    mockPricingEq.mockResolvedValueOnce({ data: [], error: null });

    await logAiTransaction({
      user_id: 'u123',
      model: 'unknown-model',
      cache_miss_tokens: 1000,
      completion_tokens: 500,
    });

    expect(mockInsert).not.toHaveBeenCalled();
  });
});
