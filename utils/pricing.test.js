import { describe, test, expect } from 'vitest';
import { costUsdFor, rateFor, PRICING } from './pricing.js';

describe('costUsdFor', () => {
  test('prices a call at the model\'s own rates, thinking billed as output', () => {
    // gemini-3.5-flash: $1.50/1M in, $9.00/1M out
    // 10_000×0.0000015 + (2_000+3_000)×0.000009 = 0.015 + 0.045
    expect(costUsdFor({
      model: 'gemini-3.5-flash',
      inputTokens: 10_000,
      outputTokens: 2_000,
      thinkingTokens: 3_000,
    })).toBeCloseTo(0.06, 10);
  });

  test('returns null for a model it has no rate for — never a stand-in price', () => {
    expect(costUsdFor({ model: 'gemini-99-unknown', inputTokens: 10_000, outputTokens: 1_000 })).toBeNull();
    expect(rateFor('gemini-99-unknown')).toBeNull();
  });

  test('cached input is billed at the cached rate, not the full one', () => {
    // gemini-3.6-flash: $0.75/1M in, $0.075/1M cached, $3.75/1M out.
    // 1_000×0.00000075 + 500×0.000000075 = 0.00075 + 0.0000375
    expect(costUsdFor({ model: 'gemini-3.6-flash', inputTokens: 1_000, cachedInputTokens: 500 })).toBeCloseTo(0.0007875, 12);
    expect(costUsdFor({ model: 'gemini-3.6-flash', inputTokens: 1_000, outputTokens: 500 })).toBeCloseTo(0.002625, 10);
  });

  // Cached tokens on a model whose cached rate is unverified must price as
  // NULL — "this happened, at an unknown price" — never silently as zero. Every
  // model currently listed has a verified cached rate, so this pins the rule
  // against a future entry added without one.
  test('cached tokens on a model with no cached rate price as null, never zero', () => {
    const withoutCached = Object.entries(PRICING).filter(([, r]) => typeof r.cachedInput !== 'number');
    for (const [model] of withoutCached) {
      expect(costUsdFor({ model, inputTokens: 100, cachedInputTokens: 500 }), `${model} priced despite no cached rate`).toBeNull();
    }
    expect(PRICING['gemini-3.6-flash'].cachedInput).toBe(0.075);
  });

  test('every model the app can select has a rate', () => {
    // The 2026-08-15 leak: model constants moved, the price list did not.
    for (const model of ['gemini-2.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash']) {
      expect(rateFor(model), `no rate for ${model}`).not.toBeNull();
    }
  });
});
