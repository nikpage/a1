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

import { applyGenerationCorrections, verifyGeneratedDoc, generateCV, dressCv } from '../utils/openai.js';

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

  // REGRESSION. A real run shipped this to the page:
  //   "While my recent roles have focused on product strategy and experience
  //    design, ."
  // The verify pass cut the tail of the sentence and the removal left the comma,
  // the space and the full stop behind. Red on the old code (which cleaned only
  // emptied bullets and blank-line runs), green now.
  test('cleans the punctuation and spacing a mid-sentence deletion orphans', () => {
    const doc = 'While my recent roles have focused on product strategy and experience design, I led the ML platform team.';
    const { content } = applyGenerationCorrections(doc, [
      { quote: ' I led the ML platform team', replacement: '', reason: 'invented fact' },
    ]);
    expect(content).toBe('While my recent roles have focused on product strategy and experience design.');
    expect(content).not.toMatch(/,\s*\./);
    expect(content).not.toMatch(/\s+\./);
  });

  test('removes the double space and leading indent a deleted span leaves', () => {
    const doc = 'I build RAG systems. Absolutely world-class work. This requires precision.\n\n  I would welcome a conversation.';
    const { content } = applyGenerationCorrections(doc, [
      { quote: 'Absolutely world-class work. ', replacement: '', reason: 'unearned intensifier' },
    ]);
    expect(content).toBe('I build RAG systems. This requires precision.\n\nI would welcome a conversation.');
    expect(content).not.toMatch(/ {2,}/);
  });

  test('a correction that only replaces text does not lose a legitimate space', () => {
    const doc = '- Led the migration to AWS with the platform team';
    const { content } = applyGenerationCorrections(doc, [
      { quote: 'Led', replacement: 'Contributed to', reason: 'upgraded claim' },
    ]);
    expect(content).toBe('- Contributed to the migration to AWS with the platform team');
  });

  // REGRESSION. A real run shipped "…a multidisciplinary group of twelve
  // Earlier, at Česká spořitelna…" — the checker's quote ran to the end of the
  // sentence, so deleting it deleted the full stop and welded the next sentence
  // on. Red on the old code, green now.
  test('a deletion whose span ends the sentence keeps the terminator', () => {
    const doc = 'I scaled the team to twelve engineers and ran the whole programme. Earlier, at the bank, I led research.';
    const { content } = applyGenerationCorrections(doc, [
      { quote: ' and ran the whole programme.', replacement: '', reason: 'invented fact' },
    ]);
    expect(content).toBe('I scaled the team to twelve engineers. Earlier, at the bank, I led research.');
  });

  test('the terminator is not doubled when one already precedes the cut', () => {
    const doc = 'I build RAG systems. World-class results every time. Precision matters.';
    const { content } = applyGenerationCorrections(doc, [
      { quote: ' World-class results every time.', replacement: '', reason: 'unearned intensifier' },
    ]);
    expect(content).toBe('I build RAG systems. Precision matters.');
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

  // Regression: the validation retry is a FRESH draft, so it can reintroduce
  // stock phrasing the first repair pass already removed. The repair used to run
  // only over the first draft, so a banned phrase written by the retry shipped
  // untouched — this is how "passionate about" reached a delivered CV.
  test('repairs stock phrasing introduced by the validation retry', async () => {
    const master = '{"experience":[]}';
    mockAxiosPost
      // 1. first draft — a number the master cannot evidence (hard failure)
      .mockResolvedValueOnce(geminiResp('### Summary\nGrew revenue by 40% in six months.', 'gemini-2.5-flash'))
      // 2. verify finds nothing to correct
      .mockResolvedValueOnce(geminiResp(JSON.stringify({ unsupported: [] })))
      // 3. validation retry — clean of numbers, but now carries a banned phrase
      .mockResolvedValueOnce(geminiResp('### Summary\nA product leader, passionate about delivery.', 'gemini-2.5-flash'))
      // 4. verify of the retry finds nothing
      .mockResolvedValueOnce(geminiResp(JSON.stringify({ unsupported: [] })))
      // 5. the stock-phrase repair over the retry
      .mockResolvedValueOnce(
        geminiResp(JSON.stringify({
          unsupported: [
            {
              quote: 'A product leader, passionate about delivery.',
              replacement: 'A product leader.',
              reason: 'banned stock phrase',
            },
          ],
        }))
      );

    const res = await generateCV({ cv: master, analysis: {}, tone: 'Formal' });

    expect(res.content).not.toContain('passionate about');
    expect(res.content).toContain('A product leader.');
    // write + verify + retry write + retry verify + retry repair — every call
    // surfaced for the cost-logging rule.
    expect(res.gemini_usages).toHaveLength(5);
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

// dressCv — the CV's counterpart to dressLetter. prompts/cv-generator.js states
// its template with <!-- BLOCK:START --> markers; a real 3.6-flash run copied
// them into the document and they reached the page. Red on the old code (no
// dressCv existed and the raw content went straight to verify), green now.
describe('dressCv — the prompt template never reaches the page', () => {
  test('strips the BLOCK scaffolding comments and the blank lines they leave', () => {
    const raw = [
      '### **Summary**',
      'Product architect who ships AI systems.',
      '<!-- BLOCK:START -->',
      '- As AI Solutions Lead at SpecialAgents.pro, built custom RAG systems.',
      '<!-- BLOCK:END -->',
      '',
      '---',
    ].join('\n');
    const out = dressCv(raw);
    expect(out).not.toMatch(/BLOCK:(START|END)/);
    expect(out).not.toMatch(/<!--/);
    expect(out).toContain('- As AI Solutions Lead at SpecialAgents.pro, built custom RAG systems.');
    expect(out).toContain('### **Summary**');
    expect(out).not.toMatch(/\n{3,}/);
  });

  test('an inline comment is removed without taking the real text with it', () => {
    expect(dressCv('- Managed a QA team <!-- keep short --> on a 3.5bn Kč programme'))
      .toBe('- Managed a QA team  on a 3.5bn Kč programme');
  });

  test('a clean CV is returned unchanged apart from trimming', () => {
    const clean = '# Nik Page\n\n### **Summary**\nBuilt RAG systems.';
    expect(dressCv(clean)).toBe(clean);
  });
});
