// __tests__/retrieval-wiring.test.js
//
// Retrieval only earns its cost if the retrieved evidence actually reaches the
// writer. Every other test in this file's neighbourhood proves a module works in
// isolation; this one proves the wiring, which is where the log records the
// expensive failures ("$0.30 of runs judged a change that was never in the
// prompt" — COVER_LETTER_LOG.md, 2026-08-25).

import { describe, it, expect } from 'vitest';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { buildLetterPickPrompt } from '../prompts/letter-pick.js';
import { buildCvPrompt, buildCvSlotsPrompt } from '../prompts/cv-generator.js';
import { adRequirements } from '../utils/cv-retrieval.js';

const analysis = {
  job_extraction: {
    must_have_requirements: ['account management', 'account management'],
    required_skills: ['B2B sales'],
    responsibilities: ['grow existing accounts'],
    nice_to_have: ['Czech']
  }
};

const retrieved = {
  groups: [
    {
      requirement: 'account management',
      chunks: [{ text: 'Head of Product at Salsita (03/2019 - 06/2022) — Turned the eBay account around' }]
    },
    {
      requirement: 'B2B sales',
      chunks: [{ text: 'Head of Product at Salsita (03/2019 - 06/2022) — Grew it from under $20k to over $100k' }]
    }
  ]
};

const text = (messages) => JSON.stringify(messages);

describe('adRequirements', () => {
  it('reads every ask the extraction holds, once each', () => {
    expect(adRequirements(analysis)).toEqual([
      'account management',
      'B2B sales',
      'grow existing accounts',
      'Czech'
    ]);
  });

  it('is empty with no ad, so a standalone run never spends on retrieval', () => {
    expect(adRequirements(null)).toEqual([]);
    expect(adRequirements({})).toEqual([]);
  });
});

describe('the retrieved evidence reaches every writer', () => {
  it('reaches the cover letter, paired with the ask it answers', () => {
    const out = text(buildCoverPrompt('RECORD', analysis, 'Formal', '', '', 'en', new Date(), null, null, retrieved));

    expect(out).toContain('THEY ASK: account management');
    expect(out).toContain('Turned the eBay account around');
    // The pairing is the point: the ask and its evidence must arrive together.
    expect(out.indexOf('THEY ASK: account management')).toBeLessThan(
      out.indexOf('Turned the eBay account around')
    );
  });

  it('reaches the letter picker, which chooses paragraphs against it', () => {
    const out = text(buildLetterPickPrompt({ analysis, master: 'RECORD', retrieved }));
    expect(out).toContain('Turned the eBay account around');
  });

  it('reaches both CV paths — the document writer and the assembler slots', () => {
    expect(text(buildCvPrompt('RECORD', analysis, 'Formal', '', '', 'en', new Date(), retrieved)))
      .toContain('Turned the eBay account around');
    expect(text(buildCvSlotsPrompt('RECORD', analysis, 'Formal', '', '', 'en', new Date(), [], retrieved)))
      .toContain('Turned the eBay account around');
  });
});

describe('without retrieval, every prompt is exactly what it was before', () => {
  it('the letter falls back to the bare asks list', () => {
    const out = text(buildCoverPrompt('RECORD', analysis, 'Formal'));

    expect(out).toContain('What this employer says it needs');
    expect(out).not.toContain('THEY ASK:');
  });

  it('empty retrieval is the same as none — no empty scaffold reaches a writer', () => {
    const empty = { groups: [] };
    const out = text(buildCoverPrompt('RECORD', analysis, 'Formal', '', '', 'en', new Date(), null, null, empty));

    expect(out).toContain('What this employer says it needs');
    expect(out).not.toContain('THE RECORD ANSWERS');
  });

  it('the CV prompts still build with no retrieval at all', () => {
    expect(() => buildCvPrompt('RECORD', analysis, 'Formal')).not.toThrow();
    // buildCvSlotsPrompt renders the block in a different function from
    // buildCvPrompt; a variable in scope in one and not the other is exactly the
    // crash this asserts against.
    expect(() => buildCvSlotsPrompt('RECORD', analysis, 'Formal')).not.toThrow();
  });

  it('the letter still gets a real date when no retrieval is passed', () => {
    // buildCvPrompt's seventh parameter is `now`, not `retrieved`. Passing the
    // retrieval object in that slot silently broke every date rule in the
    // prompt, and only reading the built prompt caught it.
    const out = text(buildCvPrompt('RECORD', analysis, 'Formal', '', '', 'en', new Date('2026-08-28')));
    expect(out).toContain('28 August 2026');
  });
});
