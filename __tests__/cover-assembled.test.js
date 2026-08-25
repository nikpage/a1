// The APP's cover-letter path, not the harness script.
//
// generateCoverLetter now routes to the assembler whenever the user has a
// structured master: the model returns which of the candidate's own paragraphs
// answer the ad, and prompts/letter-assemble.js writes the document. These tests
// call the real function and assert on the real document it returns; only the
// HTTP boundary to Gemini is stubbed.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { generateCoverLetter } from '../utils/openai.js';
import { INSTANCES, OPENINGS, CLOSES } from '../prompts/letter-library.js';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

const master = {
  profile: {
    name: 'Nik Page',
    contact: { email: 'Me@Nik.Page', phone: '+420 731 647 707', linkedin: 'www.linkedin.com/in/nbpage' }
  },
  work_experience: [{ employer: 'Salsita', title: 'Product Director', start: '01/2022', end: '12/2023' }]
};

const analysis = { job_text: 'We need someone who can own an account end to end.', job_extraction: {} };

const reply = (content) => ({
  data: {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 10 },
    model: 'gemini-3.6-flash'
  }
});

const pick = {
  contact_name: '',
  opening: 'ai-work-now',
  opening_text: '',
  instances: ['ai-realty-assistant', 'ebay-berlin-trust'],
  day_to_day: 'nuts-and-bolts',
  close: 'coffee-talk',
  language_line: false
};

const textOf = (id) => INSTANCES.find((i) => i.id === id).text;

beforeEach(() => {
  axios.post.mockReset();
});

describe('generateCoverLetter — the assembled path', () => {
  it('assembles the letter from his own paragraphs, in the order picked', async () => {
    axios.post.mockResolvedValueOnce(reply(JSON.stringify(pick)));

    const res = await generateCoverLetter({ cv: 'MASTER PROSE', master, analysis, tone: 'Formal' });

    expect(res.content).toContain(OPENINGS.find((o) => o.id === 'ai-work-now').text);
    expect(res.content).toContain(textOf('ai-realty-assistant'));
    expect(res.content).toContain(textOf('ebay-berlin-trust'));
    expect(res.content).toContain(CLOSES.find((c) => c.id === 'coffee-talk').text);
    expect(res.content).toContain('**Nik Page**');
    expect(res.content.indexOf(textOf('ai-realty-assistant')))
      .toBeLessThan(res.content.indexOf(textOf('ebay-berlin-trust')));
  });

  it('makes exactly ONE Gemini call when the opening is his own', async () => {
    axios.post.mockResolvedValueOnce(reply(JSON.stringify(pick)));

    const res = await generateCoverLetter({ cv: 'MASTER PROSE', master, analysis, tone: 'Formal' });

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(res.gemini_usages).toHaveLength(1);
  });

  it('truth-checks a MODEL-WRITTEN opening, and only the opening', async () => {
    axios.post
      .mockResolvedValueOnce(reply(JSON.stringify({ ...pick, opening: 'custom', opening_text: 'I have spent years in fintech.' })))
      .mockResolvedValueOnce(reply(JSON.stringify({ unsupported: [{ quote: 'I have spent years in fintech.', replacement: '', reason: 'derived tenure' }] })));

    const res = await generateCoverLetter({ cv: 'MASTER PROSE', master, analysis, tone: 'Formal' });

    // The verify call saw the opening alone — never his paragraphs, which are
    // his own true words and must not be span-surgeried.
    const verifyBody = JSON.stringify(axios.post.mock.calls[1][1]);
    expect(verifyBody).toContain('I have spent years in fintech.');
    expect(verifyBody).not.toContain(textOf('ai-realty-assistant'));

    // The flagged sentence is gone; his paragraphs are untouched.
    expect(res.content).not.toContain('I have spent years in fintech.');
    expect(res.content).toContain(textOf('ai-realty-assistant'));
    // and the deletion left no lone full stop standing in for the opening
    expect(res.content).not.toMatch(/Dear Hiring Team,\n\n\.\n/);
  });

  it('reports validation instead of gating on it — his own letters run long', async () => {
    axios.post.mockResolvedValueOnce(reply(JSON.stringify(pick)));

    const res = await generateCoverLetter({ cv: 'MASTER PROSE', master, analysis, tone: 'Formal' });

    // 380 words of his prose would hard-fail the 150-250 band. The document
    // still ships, and the failure reaches the user as a warning.
    expect(res.validation.ok).toBe(true);
    expect(Array.isArray(res.validation.warnings)).toBe(true);
  });

  it('falls back to the writing prompt when the pick is unusable', async () => {
    axios.post
      .mockResolvedValueOnce(reply('not json at all'))
      .mockResolvedValueOnce(reply('Dear Hiring Team,\n\nA written letter.\n\nSincerely,\nNik Page'))
      .mockResolvedValue(reply(JSON.stringify({ unsupported: [] })));

    const res = await generateCoverLetter({ cv: 'MASTER PROSE', master, analysis, tone: 'Formal' });

    expect(res.content).toContain('A written letter.');
    expect(axios.post.mock.calls.length).toBeGreaterThan(1);
  });

  it('writes the letter the old way for a user with no structured master', async () => {
    axios.post
      .mockResolvedValueOnce(reply('Dear Hiring Team,\n\nWritten by the model.\n\nSincerely,\nNik Page'))
      .mockResolvedValue(reply(JSON.stringify({ unsupported: [] })));

    const res = await generateCoverLetter({ cv: 'MASTER PROSE', master: null, analysis, tone: 'Formal' });

    expect(res.content).toContain('Written by the model.');
    expect(res.content).not.toContain(textOf('ai-realty-assistant'));
  });
});
