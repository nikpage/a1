// __tests__/consultant-speak.test.js
//
// THE THIRTEENTH PHRASE.
//
// A blocklist can only hold phrases somebody already read and wrote down. The
// Sudolabs letter (2026-08-19) was consultant-speak from end to end — "Moving at
// that pace requires closing the distance between commercial discovery and
// software delivery", "My strength lies in understanding human motivation", "I
// would be glad to schedule a brief virtual meeting" — and hit the list nowhere,
// because none of it had been seen before. Adding those twelve phrases to the
// list catches those twelve phrases and nothing else.
//
// So the defect is addressed where it is produced and where it survives:
//   the WRITER is told the shape to avoid (prompts/cover-letter.js), and
//   the REPAIR pass hunts the shape itself on every letter, not just when the
//   blocklist fired (prompts/generation-verify.js + utils/openai.js).
//
// Every test here is red on the previous revision.

vi.hoisted(() => { process.env.GEMINI_API_KEYS = 'k1'; });

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

import { bannedPhraseHits } from '../utils/cv-validate.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { buildPhraseRepairPrompt } from '../prompts/generation-verify.js';
import { repairStockPhrases } from '../utils/openai.js';

const geminiResp = (content) => ({
  data: {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    model: 'gemini-3.5-flash-lite',
  },
});

const NO_CORRECTIONS = geminiResp(JSON.stringify({ unsupported: [] }));

beforeEach(() => vi.clearAllMocks());

// The prompt is INPUTS only. These rules were in it on 2026-08-19 and the
// letter obeyed every one of them literally; see prompts/cover-letter.js.
describe('the writer is given no writing rules to perform', () => {
  const prompt = buildCoverPrompt('{}', {}, 'Formal', '', '', 'en', new Date(), null)
    .map((m) => m.content).join('\n');

  test('no shape target, no negative examples, no persuasion tips', () => {
    expect(prompt).not.toContain("stranger's letter");
    expect(prompt).not.toContain('closing the distance between commercial discovery');
    // (Both are on the BANNED PHRASES list, which is a deterministic downstream
    // check stated once — not a writing rule. What must be gone is the prose
    // that told the writer how to hinge and how to close.)
    expect(prompt).not.toContain('is the join a template reaches for');
    expect(prompt).not.toContain('No stock hinges and no stock close');
    expect(prompt).not.toMatch(/SEVEN WORDS OR FEWER/);
  });

  test('but the one absolute survives', () => {
    expect(prompt).toMatch(/Never invent, never inflate/);
  });
});

describe('the repair pass is hit-driven on both documents', () => {
  test('the LETTER is hit-driven too — no call, no second model reshaping it', async () => {
    mockAxiosPost.mockResolvedValue(NO_CORRECTIONS);
    // Consultant-speak, and not one word of it on the blocklist. It still gets
    // no repair call: an always-on shape hunt is a second model rewriting the
    // first one's letter, which is what produced the orphan paragraph.
    const doc = 'Sustained collaboration across the organisation underpins every outcome that matters.';

    const out = await repairStockPhrases({ document: doc, docType: 'cover', language: 'en' });

    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(out.content).toBe(doc);
  });

  test('the CV stays hit-driven — no call when nothing is on the list', async () => {
    mockAxiosPost.mockResolvedValue(NO_CORRECTIONS);
    const out = await repairStockPhrases({
      document: 'Cut onboarding time from 14 days to 3 at wflow.com.',
      docType: 'cv',
      language: 'en',
    });
    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(out.content).toContain('wflow.com');
  });

  test('it removes the abstraction it is told to remove, and keeps the fact', async () => {
    const doc =
      'Moving at that pace requires closing the distance between discovery and delivery. '
      + 'I cut onboarding time from 14 days to 3 at wflow.com.';
    mockAxiosPost.mockResolvedValue(geminiResp(JSON.stringify({
      unsupported: [{
        quote: 'Moving at that pace requires closing the distance between discovery and delivery.',
        replacement: '',
        reason: 'consultant-speak',
      }],
    })));

    const out = await repairStockPhrases({ document: doc, docType: 'cover', language: 'en' });

    expect(out.content).not.toContain('closing the distance');
    expect(out.content).toContain('I cut onboarding time from 14 days to 3 at wflow.com.');
    expect(out.applied).toHaveLength(1);
  });
});

// RED ON OLD: the English "brief virtual meeting" was on the list and its Czech
// twin was not, so a real Czech run (2026-08-19) closed on "Mohu nabídnout
// krátkou virtuální schůzku" — the exact stock close the list exists to stop.
describe('the stock close is caught in every registered language', () => {
  test('Czech: the stock request for a meeting, however it is inflected', () => {
    expect(bannedPhraseHits('Mohu nabídnout krátkou virtuální schůzku k projednání cílů.', 'cs'))
      .toContain('virtuální schůzku');
    expect(bannedPhraseHits('Rád bych navrhl nezávaznou schůzku.', 'cs').length).toBeGreaterThan(0);
  });

  test('Polish: the same slot', () => {
    expect(bannedPhraseHits('Zapraszam na krótkie spotkanie online.', 'pl').length).toBeGreaterThan(0);
  });

  test('a real Czech fact is not a stock phrase', () => {
    expect(bannedPhraseHits('Vedl jsem vývoj pro eBay v Salsita Software.', 'cs')).toEqual([]);
  });
});
