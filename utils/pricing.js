// utils/pricing.js — the ONE price list.
//
// Cost used to be computed twice from two different sources: this map (for the
// `[Gemini] …` console line and the daily spend guard) and the `model_pricing`
// TABLE (for the `transactions` row). The table silently lagged behind the
// model constants in utils/openai.js, and `logAiTransaction` returned without
// inserting when a model was missing from it — so on 2026-08-15, when
// generation moved to gemini-3.6-flash and the master build to
// gemini-3.5-flash-lite, every one of those calls billed at Google and wrote no
// row. The bill was real; the cost table showed nothing.
//
// One source now. A model missing here is REPORTED, never silently priced.
//
// Rates are USD per 1M tokens — verify at ai.google.dev/gemini-api/docs/pricing.
// `cachedInput` is only set where a verified rate exists; every current caller
// passes 0 cached tokens, and an unverified rate is worse than no rate.
export const PRICING = {
  'gemini-2.5-flash-lite': { input: 0.10,  cachedInput: 0.025,  output: 0.40  },
  'gemini-2.5-flash':      { input: 0.30,  cachedInput: 0.075,  output: 2.50  },
  'gemini-2.5-pro':        { input: 1.25,  cachedInput: 0.3125, output: 10.00 },
  'gemini-3.5-flash':      { input: 1.50,  cachedInput: 0.15,   output: 9.00  },
  'gemini-3.5-flash-lite': { input: 0.30,                       output: 2.50  },
  'gemini-3.6-flash':      { input: 0.75,                       output: 3.75  },
};

export function rateFor(model) {
  return PRICING[model] || null;
}

// USD for one call, or NULL when it cannot be priced honestly — an unknown
// model, or cached-input tokens on a model whose cached rate is not recorded.
// Null means "this call happened and its price is unknown", which callers must
// surface. It never means zero.
export function costUsdFor({ model, inputTokens = 0, cachedInputTokens = 0, outputTokens = 0, thinkingTokens = 0 }) {
  const rates = rateFor(model);
  if (!rates) return null;
  if (cachedInputTokens > 0 && typeof rates.cachedInput !== 'number') return null;

  // Thinking tokens bill at the output rate.
  return (inputTokens                     / 1_000_000) * rates.input
       + (cachedInputTokens               / 1_000_000) * (rates.cachedInput || 0)
       + ((outputTokens + thinkingTokens) / 1_000_000) * rates.output;
}
