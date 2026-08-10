// __tests__/generation-verify.test.js
//
// The generation verify pass: the safety net that strips claims the master
// record does not support from a generated CV/cover letter. Prompt rules alone
// let the writing model stretch real experience ("contributed to" → "led", a
// metric that was never in the record); this pass catches it AFTER the fact.
//
// These call the real applyGenerationCorrections / verifyGeneratedDoc /
// generateCV against a stubbed Gemini (the only external boundary mocked) and
// assert on the actual returned document.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

// Sacred prompt files are irrelevant to the correction mechanics.
vi.mock('../prompts/cv-generator.js', () => ({
  buildCvPrompt: () => [{ role: 'user', content: 'write cv' }],
}));

import { applyGenerationCorrections, verifyGeneratedDoc, generateCV } from '../utils/openai.js';

function geminiResp(content, model = 'gemini-2.5-flash-lite') {
  return {
    data: {
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model,
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('applyGenerationCorrections — deterministic, exact-match only', () => {
  test('downgrades an upgraded claim in place', () => {
    const doc = '- Led the migration of the billing platform to AWS\n- Wrote the deploy runbook';
    const { content, applied } = applyGenerationCorrections(doc, [
      {
        quote: 'Led the migration of the billing platform to AWS',
        replacement: 'Contributed to the migration of the billing platform to AWS',
        reason: "upgraded to 'led'",
      },
    ]);
    expect(content).toContain('- Contributed to the migration of the billing platform to AWS');
    expect(content).not.toContain('Led the migration');
    expect(content).toContain('- Wrote the deploy runbook');
    expect(applied).toHaveLength(1);
  });

  test('deletes the whole bullet when nothing truthful remains', () => {
    const doc = '- Grew revenue by 40% in six months\n- Wrote the deploy runbook';
    const { content } = applyGenerationCorrections(doc, [
      { quote: 'Grew revenue by 40% in six months', replacement: '', reason: 'invented number' },
    ]);
    expect(content).not.toContain('40%');
    expect(content).not.toMatch(/^-\s*$/m); // no stray bullet left behind
    expect(content).toContain('- Wrote the deploy runbook');
  });

  test('discards a reported span that is not literally in the document', () => {
    const doc = '- Wrote the deploy runbook';
    const { content, applied } = applyGenerationCorrections(doc, [
      { quote: 'Managed a team of 30 engineers', replacement: 'Mentored two engineers', reason: 'invented' },
    ]);
    expect(content).toBe(doc);
    expect(applied).toHaveLength(0);
  });

  test('leaves a clean document byte-identical', () => {
    const doc = '# Jane Roe\n\n- Wrote the deploy runbook\n';
    expect(applyGenerationCorrections(doc, []).content).toBe(doc);
    expect(applyGenerationCorrections(doc, undefined).content).toBe(doc);
  });
});

describe('verifyGeneratedDoc', () => {
  test('applies the checker findings and reports the verify usage for cost logging', async () => {
    mockAxiosPost.mockResolvedValueOnce(
      geminiResp(JSON.stringify({
        unsupported: [
          { quote: 'expert in Kubernetes', replacement: 'used Kubernetes', reason: 'exposure, not expertise' },
        ],
      }))
    );

    const res = await verifyGeneratedDoc({
      document: 'A platform engineer, expert in Kubernetes, based in Prague.',
      master: '{"experience":[]}',
      docType: 'cv',
    });

    expect(res.content).toBe('A platform engineer, used Kubernetes, based in Prague.');
    expect(res.gemini_usage.model).toBe('gemini-2.5-flash-lite');
    expect(res.gemini_usage.inputTokens).toBe(10);
  });

  test('returns the document untouched when the checker call fails', async () => {
    mockAxiosPost.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 400 } }));
    const doc = 'Led the migration.';
    const res = await verifyGeneratedDoc({ document: doc, master: '{}', docType: 'cv' });
    expect(res.content).toBe(doc);
    expect(res.gemini_usage).toBeNull();
  });

  test('makes no Gemini call when there is no master to check against', async () => {
    const res = await verifyGeneratedDoc({ document: 'Anything.', master: '', docType: 'cv' });
    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(res.content).toBe('Anything.');
  });
});

describe('generateCV', () => {
  test('returns the verified document and both usages, and asks for low-temperature output', async () => {
    mockAxiosPost
      .mockResolvedValueOnce(geminiResp('- Led the billing migration', 'gemini-2.5-flash'))
      .mockResolvedValueOnce(
        geminiResp(JSON.stringify({
          unsupported: [
            { quote: 'Led the billing migration', replacement: 'Contributed to the billing migration', reason: 'upgraded' },
          ],
        }))
      );

    const res = await generateCV({ cv: '{"experience":[]}', analysis: {}, tone: 'Formal' });

    expect(res.content).toBe('- Contributed to the billing migration');
    // writing call + verify call, both surfaced so both get a DB row and a console line
    expect(res.gemini_usages).toHaveLength(2);
    expect(res.gemini_usages[0].model).toBe('gemini-2.5-flash');
    expect(res.gemini_usages[1].model).toBe('gemini-2.5-flash-lite');

    const writingCallBody = mockAxiosPost.mock.calls[0][1];
    expect(writingCallBody.temperature).toBe(0.4);
    expect(writingCallBody.reasoning_effort).toBe('medium');
  });

  test('a failed verify pass still returns the written CV', async () => {
    mockAxiosPost
      .mockResolvedValueOnce(geminiResp('- Wrote the deploy runbook', 'gemini-2.5-flash'))
      .mockRejectedValue(Object.assign(new Error('nope'), { response: { status: 400 } }));

    const res = await generateCV({ cv: '{"experience":[]}', analysis: {}, tone: 'Formal' });
    expect(res.content).toBe('- Wrote the deploy runbook');
    expect(res.gemini_usages).toHaveLength(1);
  });
});
