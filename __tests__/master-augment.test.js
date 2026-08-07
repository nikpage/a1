// __tests__/master-augment.test.js
//
// augmentMaster() folds the user's own loose text ("I also did six months at
// Acme…") into their existing master CV. The properties that matter:
//   - the addition lands AND the pre-existing record survives intact. This is the
//     sharp edge: verifyMaster's deterministic grounding deletes any role whose
//     company is absent from the source it is handed, so passing only the loose
//     text as the source would wipe the user's whole career. augmentMaster passes
//     the existing master JSON + the new text, which is what keeps it.
//   - a fact the text never states is never asserted (never-fabricate).
//   - blocking questions come back to the caller instead of a half-placed role.
//
// Only the outside world is mocked (axios → Gemini). The prompt builder, the
// parse, the verify pass and the grounding are the real code under test.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1';
  process.env.UPSTASH_REDIS_REST_URL = 'http://fake.redis';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));
vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => ({ incrbyfloat: async () => 0, expire: async () => 1 }) },
}));

import { augmentMaster } from '../utils/openai.js';

function geminiResp(content) {
  return {
    data: {
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 170 },
      model: 'gemini-2.5-flash-lite',
    },
  };
}

const EXISTING = {
  identity: { name: 'Jane Roe', contact: {}, country: 'Czechia' },
  candidate_core: 'Product lead.',
  experience: [
    {
      company: 'Beta Ltd',
      role: 'Product Manager',
      dates: '2019-2022',
      location: 'Prague',
      achievements: [{ text: 'Ran the roadmap', metric: '', skills_utilized: ['roadmapping'] }],
    },
  ],
  voice_samples: ['I like shipping things that work.'],
  gaps: [],
  conflicts: [],
};

beforeEach(() => vi.clearAllMocks());

describe('augmentMaster', () => {
  test('adds the new role and leaves the pre-existing record fully intact', async () => {
    const NEW_TEXT = 'I also did six months contracting at Acme in 2023, rebuilt their checkout and cut drop-off by 20%.';
    const returned = {
      master: {
        ...EXISTING,
        experience: [
          {
            company: 'Acme',
            role: 'Contractor',
            dates: '2023',
            location: '',
            achievements: [{ text: 'Rebuilt the checkout', metric: 'cut drop-off by 20%', skills_utilized: [] }],
          },
          ...EXISTING.experience,
        ],
      },
      questions: [],
      changes: ['Added Acme — Contractor, 2023'],
    };
    mockAxiosPost
      .mockResolvedValueOnce(geminiResp(JSON.stringify(returned)))
      .mockResolvedValueOnce(geminiResp('{}')); // verify: no corrections

    const { output, questions, changes, usages } = await augmentMaster(EXISTING, NEW_TEXT);

    // The addition landed…
    expect(output.experience.map((e) => e.company)).toEqual(['Acme', 'Beta Ltd']);
    expect(output.experience[0].achievements[0].metric).toBe('cut drop-off by 20%');
    // …and NOTHING of the old record was lost by the grounding pass.
    expect(output.experience[1]).toEqual(EXISTING.experience[0]);
    expect(output.voice_samples).toEqual(['I like shipping things that work.']);
    expect(output.candidate_core).toBe('Product lead.');
    expect(questions).toEqual([]);
    expect(changes).toEqual(['Added Acme — Contractor, 2023']);
    // Both paid calls (augment + verify) are surfaced for cost logging.
    expect(usages).toHaveLength(2);
    expect(usages.every((u) => u.model && u.costUsd > 0)).toBe(true);
  });

  test('never asserts a fact the text does not state — an invented metric is stripped', async () => {
    const NEW_TEXT = 'I also did six months contracting at Acme in 2023, rebuilding their checkout.';
    const returned = {
      master: {
        ...EXISTING,
        experience: [
          {
            company: 'Acme',
            role: 'Contractor',
            dates: '2023',
            location: '',
            // The user never said 40% — the grounding pass must not let it stand.
            achievements: [{ text: 'Rebuilt the checkout', metric: 'cut drop-off by 40%', skills_utilized: [] }],
          },
          ...EXISTING.experience,
        ],
      },
      questions: [],
      changes: ['Added Acme'],
    };
    mockAxiosPost
      .mockResolvedValueOnce(geminiResp(JSON.stringify(returned)))
      .mockResolvedValueOnce(geminiResp('{}'));

    const { output } = await augmentMaster(EXISTING, NEW_TEXT);

    expect(output.experience[0].company).toBe('Acme');
    expect(output.experience[0].achievements[0].metric).toBe('');
    expect(output.needs_confirmation).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'metric', value: 'cut drop-off by 40%' })])
    );
  });

  test('returns blocking questions (capped at 2) for text it cannot place', async () => {
    const returned = {
      master: EXISTING,
      questions: ['Which company was this at?', 'Roughly what dates?', 'Anything else?'],
      changes: [],
    };
    mockAxiosPost
      .mockResolvedValueOnce(geminiResp(JSON.stringify(returned)))
      .mockResolvedValueOnce(geminiResp('{}'));

    const { questions } = await augmentMaster(EXISTING, 'I did a big turnaround project once.');

    expect(questions).toEqual(['Which company was this at?', 'Roughly what dates?']);
  });

  test('prior answers are passed to the model so the same question is not re-asked', async () => {
    mockAxiosPost
      .mockResolvedValueOnce(geminiResp(JSON.stringify({ master: EXISTING, questions: [], changes: [] })))
      .mockResolvedValueOnce(geminiResp('{}'));

    await augmentMaster(EXISTING, 'I did a big turnaround project once.', [
      { question: 'Which company was this at?', answer: 'Gamma GmbH' },
    ]);

    const sentPrompt = JSON.stringify(mockAxiosPost.mock.calls[0][1].messages);
    expect(sentPrompt).toContain('Which company was this at?');
    expect(sentPrompt).toContain('Gamma GmbH');
  });

  test('refuses to run without an existing master rather than building a new one', async () => {
    await expect(augmentMaster(null, 'some text')).rejects.toThrow(/existing master/i);
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  test('throws instead of saving junk when the model never returns a usable master', async () => {
    mockAxiosPost.mockResolvedValue(geminiResp('{"questions":[],"changes":[]}'));

    await expect(augmentMaster(EXISTING, 'some text')).rejects.toThrow(/no usable master/i);
  });
});
