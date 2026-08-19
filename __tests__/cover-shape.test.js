// __tests__/cover-shape.test.js
//
// SHAPE — the tell that no phrase list can reach.
//
// The Sudolabs letter (2026-08-19) broke no rule in this repo and still read as
// machine-written on sight: four paragraphs of near-identical weight, not one
// sentence under nine words, every clause landing at the same pace.
//
// coverShapeFaults() had measured exactly that for months — and lived inside the
// voice rewrite, which was removed from the cover path. So the measurement ran
// nowhere and the letter shipped flat.
//
// The fix keeps ONE OWNER: the fault goes back to the WRITER, once, the same way
// a hard validation failure does. A second model reshaping the first model's
// letter is the defect that produced the five-word orphan paragraph, and it is
// not coming back.
//
// Red on the previous revision, where a flat letter triggered no retry at all.

vi.hoisted(() => { process.env.GEMINI_API_KEYS = 'k1'; });

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

vi.mock('../prompts/cover-letter.js', () => ({
  buildCoverPrompt: () => [{ role: 'user', content: 'write the letter' }],
}));

import { generateCoverLetter, GEMINI_GENERATION_MODEL } from '../utils/openai.js';
import { coverShapeFaults } from '../utils/cv-validate.js';

const geminiResp = (content) => ({
  data: {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    model: 'gemini-3.6-flash',
  },
});
const NO_CORRECTIONS = geminiResp(JSON.stringify({ unsupported: [] }));

const wrap = (body) => `Dear Hiring Team,\n\n${body}\n\nSincerely,\n\nNik Page`;

// Every sentence the same weight, nothing short. The Sudolabs shape.
const FLAT = wrap(
  'I led the consolidation of three separate platforms into one product at wflow.com over eighteen months. '
  + 'I coached four product managers through that programme and each of them stayed with the company afterwards. '
  + 'I built the product operations function at Salsita Software from nothing across two full years of work. '
  + 'I directed concurrent client software initiatives for accounts including eBay and delivered them on schedule.',
);

// Same facts, real rhythm: a very short sentence, wide variation.
const VARIED = wrap(
  'Three platforms became one. I led that consolidation at wflow.com over eighteen months, coaching four '
  + 'product managers through it, and every one of them stayed.\n\n'
  + 'Before that I built the product operations function at Salsita Software from nothing, and ran client '
  + 'delivery for accounts including eBay. It shipped on time.',
);

const writingCalls = () =>
  mockAxiosPost.mock.calls.filter(([, b]) => b?.model === GEMINI_GENERATION_MODEL).length;

// The pipeline's checker calls vary in number with what the document contains,
// so the mock answers by ROLE rather than by position: the writing model gets
// the drafts in order, every checker gets an empty verdict. Counting calls to
// line up fixtures is what makes a pipeline test break on unrelated changes.
function writer(...drafts) {
  let n = 0;
  mockAxiosPost.mockImplementation(async (_url, body) => {
    if (body?.model === GEMINI_GENERATION_MODEL) {
      return geminiResp(drafts[Math.min(n++, drafts.length - 1)]);
    }
    return NO_CORRECTIONS;
  });
}

beforeEach(() => vi.clearAllMocks());

describe('the measurement itself', () => {
  test('the flat letter is flat and the varied one is not', () => {
    // If this ever inverts, every test below is measuring the wrong thing.
    expect(coverShapeFaults(FLAT).length).toBeGreaterThan(0);
    expect(coverShapeFaults(VARIED)).toEqual([]);
  });
});

// SHAPE IS MEASURED, NEVER FED BACK. Handing the writer "one sentence of seven
// words or fewer" got exactly that and nothing else: "I manage outcomes, not
// people." as an orphan paragraph in the Sudolabs letter (2026-08-19), the same
// defect the removed voice rewrite produced. The measurement stays; the retry
// on it is gone.
describe('a flat letter is not sent back to the writer', () => {
  test('no second writing call, no money spent chasing a rhythm target', async () => {
    writer(FLAT, VARIED);

    const { content } = await generateCoverLetter({ cv: '{}', analysis: {}, tone: 'Formal' });

    expect(writingCalls()).toBe(1);
    // The draft the writer produced is what ships, flat or not.
    expect(content).toContain('I directed concurrent client software initiatives');
    // And the fault is still measurable — Layer 6 can report it.
    expect(coverShapeFaults(content).length).toBeGreaterThan(0);
  });
});

describe('a letter with real rhythm is left alone', () => {
  test('no second writing call, no money spent reshaping a good letter', async () => {
    writer(VARIED);

    const { content } = await generateCoverLetter({ cv: '{}', analysis: {}, tone: 'Formal' });

    expect(writingCalls()).toBe(1);
    expect(content).toContain('Three platforms became one.');
  });
});
