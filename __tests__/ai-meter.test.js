// __tests__/ai-meter.test.js
//
// The meter is what makes a 5x bill impossible to repeat, so these tests are
// about the two ways spend went missing on 2026-08-15 and the one thing that
// would have stopped it:
//
//   1. money spent on a call whose response then failed to parse — billed by
//      Google, never written to `transactions` (red on the old code, where the
//      logging line sat after the parse);
//   2. a model with no recorded rate — the row used to be dropped entirely;
//   3. nothing ever STOPPED. The guard logged and the run carried on.
//
// Only external boundaries are mocked: axios (the network) and utils/database.js
// (Supabase). The meter, callGemini and the pricing math are the real ones.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1,key2';
  process.env.GEMINI_DAILY_BUDGET_USD = '10';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
const mockLogAiTransaction = vi.hoisted(() => vi.fn());
const mockGetAiSpendSince = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

vi.mock('../utils/database.js', () => ({
  logAiTransaction: mockLogAiTransaction,
  getAiSpendSince: mockGetAiSpendSince,
}));

vi.mock('../prompts/analysis.js', () => ({ buildAnalysisPrompt: () => [{ role: 'user', content: 'x' }] }));
vi.mock('../prompts/cv-generator.js', () => ({ buildCvPrompt: () => [{ role: 'user', content: 'x' }], buildHeadlinePrompt: () => [] }));
vi.mock('../prompts/cover-letter.js', () => ({ buildCoverPrompt: () => [{ role: 'user', content: 'x' }] }));
vi.mock('../prompts/job-extraction.js', () => ({ buildJobExtractionPrompt: () => [{ role: 'user', content: 'x' }] }));
vi.mock('../prompts/analysis-teaser.js', () => ({ buildAnalysisTeaserPrompt: () => [{ role: 'user', content: 'x' }] }));

const PRICED_MODEL = 'gemini-2.5-flash-lite'; // $0.10 in / $0.40 out per 1M

// One Gemini response, priced and token-split exactly like the real thing.
const responseFor = (content, model = PRICED_MODEL) => ({
  data: {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1250 }, // 50 thinking
    model,
  },
});

let callGemini, analyzeJobOnly, runWithAiContext, assertUnderBudget, dailySpend, AiBudgetError, logger;
let inCtx;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mockGetAiSpendSince.mockResolvedValue({ total: 0, unpriced: 0 });
  mockLogAiTransaction.mockResolvedValue(undefined);
  process.env.GEMINI_BUDGET_ENFORCE = 'true';
  ({ callGemini, analyzeJobOnly } = await import('../utils/openai.js'));
  ({ runWithAiContext, assertUnderBudget, dailySpend, AiBudgetError } = await import('../utils/ai-meter.js'));
  // vi.resetModules() gives each test a fresh ai-meter — and so a fresh, empty
  // AsyncLocalStorage that the runner's global context (vitest.setup.js) no
  // longer reaches. callGemini refuses an unattributed call, so each test that
  // makes one runs inside `inCtx`.
  inCtx = (fn) => runWithAiContext({ user_id: 'user-1', context: 'test' }, fn);
  ({ logger } = await import('../lib/logger.js'));
});

describe('every billed call is recorded', () => {
  test('a successful call writes one row with the model, token split and step', async () => {
    mockAxiosPost.mockResolvedValue(responseFor('hello'));

    await runWithAiContext({ user_id: 'user-1', context: 'test', source_gen_id: 'gen-9' }, () =>
      callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'generate CV' })
    );

    expect(mockLogAiTransaction).toHaveBeenCalledTimes(1);
    expect(mockLogAiTransaction.mock.calls[0][0]).toMatchObject({
      user_id: 'user-1',
      source_gen_id: 'gen-9',
      model: PRICED_MODEL,
      cache_miss_tokens: 1000,
      completion_tokens: 250, // 200 output + 50 thinking, both billed at the output rate
      thinking_tokens: 50,
      detail: expect.objectContaining({ context: 'test', step: 'generate CV' }),
    });
  });

  // THE 2026-08-15 DEFECT. The old code logged after JSON.parse succeeded, so a
  // response that could not be parsed cost money and left no trace. Red on the
  // old code: analyzeJobOnly threw before its trackDailySpend/logAiTransaction
  // lines ever ran.
  test('a call whose response fails to parse is STILL recorded', async () => {
    mockAxiosPost.mockResolvedValue(responseFor('not json at all'));

    await expect(inCtx(() => analyzeJobOnly('some job ad'))).rejects.toThrow(/invalid JSON/i);

    expect(mockLogAiTransaction).toHaveBeenCalledTimes(1);
    expect(mockLogAiTransaction.mock.calls[0][0]).toMatchObject({
      model: PRICED_MODEL,
      cache_miss_tokens: 1000,
    });
  });

  // Each retry is a separate billed response and gets its own row.
  test('a transient failure then a success records only the response that arrived', async () => {
    const err = new Error('overloaded');
    err.response = { status: 503, data: { error: { message: 'model overloaded' } } };
    mockAxiosPost.mockRejectedValueOnce(err).mockResolvedValueOnce(responseFor('ok'));

    await inCtx(() => callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'generate CV' }));

    // The 503 was never billed — nothing came back. The success was.
    expect(mockLogAiTransaction).toHaveBeenCalledTimes(1);
  });

  test('an unpriced model still gets a row, and the missing rate is shouted', async () => {
    const spyError = vi.spyOn(logger, 'error');
    mockAxiosPost.mockResolvedValue(responseFor('hello', 'gemini-99-does-not-exist'));

    await inCtx(() => callGemini('gemini-99-does-not-exist', [{ role: 'user', content: 'hi' }], { label: 'mystery' }));

    expect(mockLogAiTransaction).toHaveBeenCalledTimes(1);
    expect(mockLogAiTransaction.mock.calls[0][0]).toMatchObject({ model: 'gemini-99-does-not-exist' });
    expect(spyError.mock.calls.flat().join(' ')).toMatch(/no rate recorded/i);
  });

  // Losing the row must be loud enough to reconstruct it by hand.
  test('a failed insert does not fail the call, but is reported with the numbers', async () => {
    const spyError = vi.spyOn(logger, 'error');
    mockLogAiTransaction.mockRejectedValue(new Error('supabase down'));
    mockAxiosPost.mockResolvedValue(responseFor('hello'));

    const data = await inCtx(() => callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'generate CV' }));

    expect(data.choices[0].message.content).toBe('hello');
    const msg = spyError.mock.calls.flat().join(' ');
    expect(msg).toMatch(/FAILED TO RECORD/);
    expect(msg).toMatch(/in=1000/);
    expect(msg).toMatch(/supabase down/);
  });

  test('the label never reaches the Gemini request body', async () => {
    mockAxiosPost.mockResolvedValue(responseFor('hello'));

    await inCtx(() => callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'generate CV', temperature: 0.4 }));

    const body = mockAxiosPost.mock.calls[0][1];
    expect(body.label).toBeUndefined();
    expect(body.temperature).toBe(0.4);
  });
});

describe('no context, no call', () => {
  // The strongest guarantee in the file: a call nobody claimed never happens.
  // An unattributed call cannot be billed to a user, a surface or a script, so
  // it is refused outright rather than recorded as "unattributed" and hoped
  // about. Forgetting one line now costs a crash instead of money.
  test('an unattributed call is refused before it is dispatched', async () => {
    mockAxiosPost.mockResolvedValue(responseFor('hello'));

    await expect(
      callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'orphan' })
    ).rejects.toMatchObject({ code: 'no_ai_context' });

    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(mockLogAiTransaction).not.toHaveBeenCalled();
  });

  test('the refusal says exactly how to fix it', async () => {
    await expect(
      callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'orphan' })
    ).rejects.toThrow(/runWithAiContext|withAiContext|enterAiContext/);
  });
});

describe('the daily ceiling stops spend, it does not merely note it', () => {
  test('over budget: the call is blocked before it is dispatched', async () => {
    mockGetAiSpendSince.mockResolvedValue({ total: 12.5, unpriced: 0 });
    mockAxiosPost.mockResolvedValue(responseFor('hello'));

    await expect(
      inCtx(() => callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'generate CV' }))
    ).rejects.toBeInstanceOf(AiBudgetError);

    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(mockLogAiTransaction).not.toHaveBeenCalled();
  });

  // A block is a decision, not a transport error: it must not be retried across
  // all six attempts (which is how a "guard" turns into six more failures).
  test('a block is not retried and not key-rotated', async () => {
    mockGetAiSpendSince.mockResolvedValue({ total: 99, unpriced: 0 });

    await expect(
      inCtx(() => callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'x' }))
    ).rejects.toMatchObject({ code: 'budget_exceeded' });

    expect(mockGetAiSpendSince).toHaveBeenCalledTimes(1);
  });

  test('spend metered inside one run counts immediately, without re-reading the ledger', async () => {
    // Ledger reads $9.9995 once; a single call costing more than the remainder
    // must push the total over and block the NEXT call in the same run.
    mockGetAiSpendSince.mockResolvedValue({ total: 9.9999, unpriced: 0 });
    mockAxiosPost.mockResolvedValue(responseFor('hello'));

    await inCtx(() => callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'first' }));
    await expect(
      inCtx(() => callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'second' }))
    ).rejects.toBeInstanceOf(AiBudgetError);

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });

  test('GEMINI_BUDGET_ENFORCE=false reports but lets the call through', async () => {
    process.env.GEMINI_BUDGET_ENFORCE = 'false';
    vi.resetModules();
    ({ callGemini } = await import('../utils/openai.js'));
    const { runWithAiContext: rwc } = await import('../utils/ai-meter.js');
    mockGetAiSpendSince.mockResolvedValue({ total: 50, unpriced: 0 });
    mockAxiosPost.mockResolvedValue(responseFor('hello'));

    const data = await rwc({ context: 'test' }, () => callGemini(PRICED_MODEL, [{ role: 'user', content: 'hi' }], { label: 'x' }));

    expect(data.choices[0].message.content).toBe('hello');
  });

  test('unpriced rows are counted separately and reported, never as zero', async () => {
    const spyError = vi.spyOn(logger, 'error');
    mockGetAiSpendSince.mockResolvedValue({ total: 1.0, unpriced: 3 });

    await assertUnderBudget('gemini-2.5-flash-lite');

    const msg = spyError.mock.calls.flat().join(' ');
    expect(msg).toMatch(/3 call\(s\) today have no recorded rate/);
    expect(msg).toMatch(/at least \$1\.0000/);
  });

  test('an unreadable ledger reports the read failure and marks the figure stale', async () => {
    const spyError = vi.spyOn(logger, 'error');
    mockGetAiSpendSince.mockRejectedValue(new Error('supabase down'));

    const spend = await dailySpend({ force: true });

    expect(spend.stale).toBe(true);
    expect(spyError.mock.calls.flat().join(' ')).toMatch(/could not read today's spend/i);
  });
});
