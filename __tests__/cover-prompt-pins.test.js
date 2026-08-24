// __tests__/cover-prompt-pins.test.js
//
// PINS FOR THE THREE COVER-LETTER WINS THAT NOTHING GUARDED.
//
// Each of these was measured on a real record against a real ad, recorded in
// COVER_LETTER_LOG.md, and then left standing on prose alone: a comment in
// CLAUDE.md saying "do not undo this". A comment does not fail a test run, so
// each could be reverted by a plausible-looking simplification with the whole
// suite still green. That is the loop these tests exist to break.
//
//   1. The letter reads the AD ITSELF, verbatim — not the extraction.
//   2. The writing prompt stays MINIMAL — the 51,721-character rule stack that
//      lost every comparison on 2026-08-15 does not grow back.
//   3. ONE OWNER — applyVoice() does not run on the cover path.
//
// All three call the real prompt builder over real inputs, or read the real
// source of the real function. No mock stands in for the unit under test.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCoverPrompt } from '../prompts/cover-letter.js';

const MASTER = JSON.stringify({
  profile: { name: 'Nik Page' },
  work_experience: [
    { title: 'Head of Product', company: 'wflow.com', start_date: '01/2022', end_date: '06/2024',
      bullets: ['Consolidated three platforms into one'] },
  ],
});

// An ad with a REGISTER: the informal second person and the stated negative are
// exactly what extraction de-natures into a bullet list, and answering them is
// what makes a letter read as written for this job.
const RAW_AD = `Hledáme člověka, který se nebojí computer science.
Nechceme někoho, kdo celý den obvolává studené kontakty.
Neexistuje žádný univerzální recept — a to je na tom to nejlepší.`;

const ANALYSIS = {
  job_text: RAW_AD,
  job_extraction: {
    position_title: 'Product Manager',
    company: 'KUBO',
    location: 'Praha',
    // The de-natured version. Present on the record, and the letter must NOT be
    // written from it while the raw ad exists.
    must_have_requirements: ['Stakeholder management', 'Roadmap ownership', 'B2B sales support'],
  },
};

const promptText = (analysis) =>
  buildCoverPrompt(MASTER, analysis, 'Formal', '', '', 'en', new Date('2026-08-18T09:00:00Z'), null)
    .map((m) => m.content)
    .join('\n');

describe('PIN 1 — the letter is written from the ad in the employer\'s own words', () => {
  test('the raw ad reaches the prompt verbatim, register intact', () => {
    const text = promptText(ANALYSIS);
    // Not a paraphrase and not a summary: the employer's own sentences.
    expect(text).toContain('se nebojí computer science');
    expect(text).toContain('Nechceme někoho, kdo celý den obvolává studené kontakty.');
    expect(text).toContain('Neexistuje žádný univerzální recept');
  });

  test('the extraction is NOT the source while a raw ad exists', () => {
    const text = promptText(ANALYSIS);
    // targetJobBlock() renders key_requirements; rawAdBlock() does not. If this
    // line appears, the prompt fell back to the bullet list.
    expect(text).not.toContain('Roadmap ownership');
    expect(text).not.toContain('B2B sales support');
  });

  test('the employer and the role are still named, from either record', () => {
    const text = promptText(ANALYSIS);
    expect(text).toContain('KUBO');
    expect(text).toContain('Product Manager');
  });

  test('the extraction remains the fallback when no raw ad was saved', () => {
    const { job_text, ...noRaw } = ANALYSIS;
    const text = promptText(noRaw);
    // Older analyses and standalone reviews still get a job target.
    expect(text).toContain('Roadmap ownership');
    expect(text).not.toContain('se nebojí computer science');
  });
});

describe('PIN 2 — the writing prompt stays minimal', () => {
  // The stack that lost on 2026-08-15 was 51,721 characters, ~33,000 of them
  // byte-identical for every user and every job. The minimal prompt measures
  // around 6k with an ad attached. Raised from 15,000 to 20,000 on 2026-08-24
  // when the register exemplar went from one hand-written letter to three
  // (~2.9k): three shapes stop the pipeline copying one as a mould, and the
  // letters themselves are the cheapest instruction in this prompt. 20,000 is
  // still far below any restored stack, so this fails on the regression, not
  // on an ordinary edit.
  const CEILING = 20000;

  test('a full prompt with an ad stays under the ceiling', () => {
    const text = promptText(ANALYSIS);
    expect(text.length).toBeLessThan(CEILING);
  });

  test('the removed rules do not come back', () => {
    const text = promptText(ANALYSIS).toLowerCase();
    // Each of these lost a measured comparison. See CLAUDE.md, "The cover
    // letter", for the run that condemned each.
    // - opening prescribed as a candidate fact (letter opened on the last job)
    expect(text).not.toContain('open on a fact the candidate did');
    // - recency preferred over relevance
    expect(text).not.toContain('most recent achievement');
    // - the shape prescribed as prose (labelled themes are permitted)
    expect(text).not.toContain('write in flowing paragraphs');
    // - the identity-epithet ban, which binds the CV and not the letter
    expect(text).not.toContain('epithet');
  });
});

describe('PIN 3 — one document, one owner', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../utils/openai.js', import.meta.url)),
    'utf8',
  );

  // A static read of the real function body. applyVoice() is defined in the
  // same module as generateCoverLetter, so no runtime spy can see the call —
  // and the defect being pinned IS the presence of the call. Same shape as
  // __tests__/ai-spend-containment.test.js, which guards the single door to
  // Gemini by reading source.
  const coverBody = (() => {
    const start = source.indexOf('export async function generateCoverLetter');
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf('\nexport ', start + 1);
    return source.slice(start, next === -1 ? source.length : next);
  })();

  test('generateCoverLetter never calls applyVoice', () => {
    // A second model reshaping the first model's letter is the defect that
    // produced the five-word orphan paragraph. The writer owns the voice.
    expect(coverBody).not.toMatch(/\bawait\s+applyVoice\s*\(/);
    expect(coverBody).not.toMatch(/\bapplyVoice\s*\(/);
  });

  test('the writer still receives the voice profile itself', () => {
    // One owner does not mean no voice: the profile goes into the prompt.
    expect(coverBody).toContain('voiceProfile');
    const withVoice = buildCoverPrompt(
      MASTER, ANALYSIS, 'Formal', '', '', 'en', new Date('2026-08-18T09:00:00Z'),
      { list_a: ['Leads with the point, then evidences it.'], list_b: [], samples: ['I ran the numbers before the meeting and brought one page.'] },
    ).map((m) => m.content).join('\n');
    expect(withVoice).toContain('Leads with the point, then evidences it.');
  });
});
