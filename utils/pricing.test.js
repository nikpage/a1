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

  test('returns null when cached tokens are billed on a model with no cached rate', () => {
    // gemini-3.6-flash has no verified cachedInput rate recorded.
    expect(PRICING['gemini-3.6-flash'].cachedInput).toBeUndefined();
    expect(costUsdFor({ model: 'gemini-3.6-flash', inputTokens: 100, cachedInputTokens: 500 })).toBeNull();
    // …but the same model prices normally when nothing is cached.
    expect(costUsdFor({ model: 'gemini-3.6-flash', inputTokens: 1_000, outputTokens: 500 })).toBeCloseTo(0.002625, 10);
  });

  test('every model the app can select has a rate', () => {
    // The 2026-08-15 leak: model constants moved, the price list did not.
    for (const model of ['gemini-2.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash']) {
      expect(rateFor(model), `no rate for ${model}`).not.toBeNull();
    }
  });
});
