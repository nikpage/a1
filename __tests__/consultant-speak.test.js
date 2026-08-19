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

describe('the writer is told the shape, not just the words', () => {
  const prompt = buildCoverPrompt('{}', {}, 'Formal', '', '', 'en', new Date(), null)
    .map((m) => m.content).join('\n');

  test('it bans an abstraction standing where a fact belongs', () => {
    expect(prompt).toContain('abstraction');
    // The reusability test is the operative instruction: a sentence that would
    // survive being pasted into a stranger's letter is about nobody.
    expect(prompt.toLowerCase()).toContain("stranger's letter");
  });

  test('it names the real sentences that failed, so the shape is unmistakable', () => {
    expect(prompt).toContain('closing the distance between commercial discovery');
    expect(prompt).toContain('My strength lies in understanding human motivation');
  });

  test('it bans the stock hinge and the stock close', () => {
    expect(prompt).toContain('In this capacity');
    expect(prompt).toContain('brief virtual meeting');
  });
});

describe('the repair pass hunts the shape itself', () => {
  test('the stock prompt describes both shapes and forbids flagging specifics', () => {
    const [system] = buildPhraseRepairPrompt({ docType: 'cover', document: 'x', hits: [], kind: 'stock' });
    expect(system.content).toContain('CONSULTANT-SPEAK');
    expect(system.content).toContain('ABSTRACTION STANDING WHERE A FACT BELONGS');
    expect(system.content).toContain('STOCK HINGE');
    // The conservative half. Without it the pass eats real achievements.
    expect(system.content).toContain('DO NOT flag');
    expect(system.content).toContain('names a real employer, number, product, date or action');
  });

  test('it works with no blocklist hits at all', () => {
    const [system] = buildPhraseRepairPrompt({ docType: 'cover', document: 'x', hits: [], kind: 'stock' });
    // The old builder interpolated an empty list and told the model to repair
    // "" — the sentence it produced was 'THE PHRASES FOUND IN THIS DOCUMENT: .'
    expect(system.content).toContain('No phrase from the known list appears');
    expect(system.content).not.toMatch(/DOCUMENT: \./);
  });

  test('a letter with zero banned phrases is still checked', async () => {
    mockAxiosPost.mockResolvedValue(NO_CORRECTIONS);
    // Consultant-speak, and not one word of it on the blocklist.
    const doc = 'Delivering at that velocity demands alignment across the value chain.';

    const out = await repairStockPhrases({ document: doc, docType: 'cover', language: 'en' });

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    const [, body] = mockAxiosPost.mock.calls[0];
    expect(body.messages[0].content).toContain('CONSULTANT-SPEAK');
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
