// __tests__/cover-contract.test.js
//
// THE COVER LETTER'S CONTRACT (CV_RULES.md, "The cover letter's contract" →
// Layer 6 checks 26-30). Four clauses that are not judgement calls: the letter
// answers the ad's requirements with the record's evidence, it addresses a red
// flag where one exists and the record answers it, it is written in the
// candidate's voice or in deliberately plain prose, and it obeys the steering
// and the requested language.
//
// Everything here calls the real validator and the real prompt builder over
// real inputs. No mock stands in for the unit under test, and every assertion
// names a specific string or verdict, so each test can fail. All five checks are
// new code: every one of these is red on the previous revision, where the
// validator had no notion of a contract at all.

import { describe, test, expect } from 'vitest';
import { validateCoverLetter } from '../utils/cv-validate.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { composeTweak, parseTweak } from '../utils/steering.js';

const MASTER = JSON.stringify({
  profile: { name: 'Nik Page' },
  work_experience: [
    {
      title: 'Head of Product',
      company: 'wflow.com',
      start_date: '01/2022', end_date: '06/2024',
      bullets: ['Consolidated three platforms into one', 'Coached four product managers'],
    },
    {
      title: 'Product Owner',
      company: 'Salsita Software',
      start_date: '01/2019', end_date: '12/2021',
      bullets: ['Built the product operations function'],
    },
  ],
});

const EVIDENCE = {
  requirement_evidence: [
    { requirement: 'lead a team of product managers', evidence: 'coached four product managers at wflow.com' },
    { requirement: 'platform consolidation', evidence: 'consolidated three platforms at wflow.com' },
  ],
  concerns: [{ flag: 'consultancy vs permanence', answer_evidence: 'four years embedded full time at wflow.com' }],
};

function analysisWith(coverEvidence = EVIDENCE, country = 'Czechia') {
  return {
    job_extraction: { position_title: 'Head of Product', company: 'PLG Group' },
    job_data: { Country: country },
    generation_framework: { cover_evidence: coverEvidence },
  };
}

const letter = (body) => `13.08.2026\n\nDear Deborah,\n\n${body}\n\nSincerely,\n\n**Nik Page**\n+420 731 647`;

// A letter that satisfies every clause, used as the control: each test below
// breaks exactly one thing about it, so a failure names the check that fired.
const GOOD = letter(
  'I coached four product managers at wflow.com and consolidated three platforms into one, which is the work PLG Group is hiring for. That was four years embedded full time at wflow.com, not a series of short engagements. The work needed judgement about what to cut.\n\nI built the product operations function at Salsita Software before that. It shipped.'
);

describe('the control letter satisfies the whole contract', () => {
  test('no hard failure at all', () => {
    const { ok, hard } = validateCoverLetter(GOOD, { master: MASTER, analysis: analysisWith(), language: 'en' });
    expect(hard).toEqual([]);
    expect(ok).toBe(true);
  });
});

// ── Check 26 — language (C4) ────────────────────────────────────────────────
describe('check 26 — the letter is in the requested language', () => {
  const CZECH = letter(
    'Vedl jsem čtyři produktové manažery ve wflow.com a sloučil jsem tři platformy do jedné. Byly to čtyři roky na plný úvazek ve wflow.com, ne série krátkých zakázek. Ta práce vyžadovala úsudek o tom, co škrtnout a co ponechat pro další období.'
  );

  test('an English letter requested in Czech is a hard failure', () => {
    const { ok, hard } = validateCoverLetter(GOOD, { master: MASTER, analysis: analysisWith(), language: 'cs' });
    expect(ok).toBe(false);
    expect(hard.join(' ')).toMatch(/not written in the requested language \(cs\)/);
  });

  test('a Czech letter requested in English is a hard failure', () => {
    const { hard } = validateCoverLetter(CZECH, { master: MASTER, analysis: analysisWith(), language: 'en' });
    expect(hard.join(' ')).toMatch(/not written in the requested language \(en\)/);
  });

  test('a Czech letter requested in Czech passes the language check', () => {
    const { hard } = validateCoverLetter(CZECH, { master: MASTER, analysis: analysisWith(), language: 'cs' });
    expect(hard.join(' ')).not.toMatch(/requested language/);
  });

  test("'auto' states no target, so the check reports nothing either way", () => {
    for (const doc of [GOOD, CZECH]) {
      const { hard } = validateCoverLetter(doc, { master: MASTER, analysis: analysisWith(), language: 'auto' });
      expect(hard.join(' ')).not.toMatch(/requested language/);
    }
  });

  // An English quotation inside Czech prose is not an English letter: the check
  // reads function words, not nouns, so a job title lifted from the ad is inert.
  test('an English job title quoted inside a Czech letter does not fail it', () => {
    const mixed = letter(
      'Vedl jsem čtyři produktové manažery ve wflow.com na pozici Head of Product a sloučil jsem tři platformy do jedné. Byly to čtyři roky na plný úvazek, ne série krátkých zakázek, a ta práce vyžadovala úsudek.'
    );
    const { hard } = validateCoverLetter(mixed, { master: MASTER, analysis: analysisWith(), language: 'cs' });
    expect(hard.join(' ')).not.toMatch(/requested language/);
  });
});

// ── Check 27 — at least one evidenced requirement answered (C1) ─────────────
describe('check 27 — the letter answers at least one answerable requirement', () => {
  test('answering none is a hard failure naming the count', () => {
    const none = letter('I would bring energy and curiosity to wflow.com and to your organisation every single day of the week.');
    const { ok, hard } = validateCoverLetter(none, { master: MASTER, analysis: analysisWith(), language: 'en' });
    expect(ok).toBe(false);
    expect(hard.join(' ')).toMatch(/answers none of the 2 requirements/);
  });

  test('answering one of two is enough — the pool is not a quota', () => {
    const one = letter('I coached four product managers at wflow.com over four years embedded full time there. It changed how the team shipped.');
    const { hard } = validateCoverLetter(one, { master: MASTER, analysis: analysisWith(), language: 'en' });
    expect(hard.join(' ')).not.toMatch(/answers none of/);
  });

  test('no evidence pool means nothing to answer and no verdict', () => {
    const bare = analysisWith({ requirement_evidence: [], concerns: [] });
    const { ok } = validateCoverLetter(letter('Short body about nothing in particular, addressed to PLG Group.'), { master: MASTER, analysis: bare, language: 'en' });
    expect(ok).toBe(true);
  });
});

// ── Check 28 — a red flag is addressed where one exists (C2) ────────────────
describe('check 28 — a recruiter concern the record answers is addressed', () => {
  test('a letter that answers the requirements but no concern is a hard failure', () => {
    const noFlag = letter('I coached four product managers at wflow.com and consolidated three platforms into one. The work needed judgement.');
    const { ok, hard } = validateCoverLetter(noFlag, { master: MASTER, analysis: analysisWith(), language: 'en' });
    expect(ok).toBe(false);
    expect(hard.join(' ')).toMatch(/addresses none of the 1 recruiter concerns/);
  });

  test('carrying the answering fact clears it', () => {
    const { hard } = validateCoverLetter(GOOD, { master: MASTER, analysis: analysisWith(), language: 'en' });
    expect(hard.join(' ')).not.toMatch(/recruiter concerns/);
  });

  // The silence that matters: a concern with no answering fact would force the
  // letter to invent one, which the invariants forbid.
  test('a concern with no answering evidence is not demanded of the letter', () => {
    const unanswerable = analysisWith({
      requirement_evidence: EVIDENCE.requirement_evidence,
      concerns: [{ flag: 'candidate is over fifty', answer_evidence: '' }],
    });
    const noFlag = letter('I coached four product managers at wflow.com and consolidated three platforms into one. The work needed judgement.');
    const { hard } = validateCoverLetter(noFlag, { master: MASTER, analysis: unanswerable, language: 'en' });
    expect(hard.join(' ')).not.toMatch(/recruiter concerns/);
  });
});

// ── Checks 29 and 30 — steering (C4) ───────────────────────────────────────
describe('checks 29 and 30 — the steering governs the first paragraph', () => {
  const emphasiseSalsita = composeTweak({ emphasise: 'the product operations work at Salsita Software' });
  const demoteSalsita = composeTweak({ playDown: 'the product operations work at Salsita Software' });

  test('parseTweak recovers exactly what composeTweak wrote', () => {
    const tweak = composeTweak({ emphasise: 'the Salsita work', playDown: 'the banks', freeform: 'keep it short' });
    expect(parseTweak(tweak)).toEqual({ emphasise: 'the Salsita work', playDown: 'the banks' });
  });

  test('emphasised content missing from the first paragraph is a hard failure', () => {
    const { ok, hard } = validateCoverLetter(GOOD, {
      master: MASTER, analysis: analysisWith(), language: 'en', tweak: emphasiseSalsita,
    });
    expect(ok).toBe(false);
    expect(hard.join(' ')).toMatch(/The first paragraph does not carry it/);
  });

  test('emphasised content present in the first paragraph passes', () => {
    const led = letter(
      'I built the product operations function at Salsita Software, and it survived the handover. Four years embedded full time at wflow.com came after, where I coached four product managers.'
    );
    const { hard } = validateCoverLetter(led, {
      master: MASTER, analysis: analysisWith(), language: 'en', tweak: emphasiseSalsita,
    });
    expect(hard.join(' ')).not.toMatch(/first paragraph/);
  });

  test('demoted content in the first paragraph is a hard failure', () => {
    const led = letter(
      'I built the product operations function at Salsita Software, and it survived the handover. Four years embedded full time at wflow.com came after, where I coached four product managers.'
    );
    const { ok, hard } = validateCoverLetter(led, {
      master: MASTER, analysis: analysisWith(), language: 'en', tweak: demoteSalsita,
    });
    expect(ok).toBe(false);
    expect(hard.join(' ')).toMatch(/is in the first paragraph, which is the one position that contradicts that outright/);
  });

  // Demotion is not deletion (T2): a later, plain mention is still allowed.
  test('demoted content mentioned later, outside the first paragraph, passes', () => {
    const late = letter(
      'I coached four product managers at wflow.com and consolidated three platforms into one. Four years embedded full time there, not a series of short engagements.\n\nBefore that I built the product operations function at Salsita Software.'
    );
    const { hard } = validateCoverLetter(late, {
      master: MASTER, analysis: analysisWith(), language: 'en', tweak: demoteSalsita,
    });
    expect(hard.join(' ')).not.toMatch(/first paragraph/);
  });

  test('no steering means no verdict from either check', () => {
    const { hard } = validateCoverLetter(GOOD, { master: MASTER, analysis: analysisWith(), language: 'en', tweak: '' });
    expect(hard.join(' ')).not.toMatch(/first paragraph/);
  });
});

// ── The contract reaches the writer, stated once ───────────────────────────
describe('the contract is stated to the writer, once, at the top', () => {
  const promptText = (voiceProfile = null) =>
    buildCoverPrompt(MASTER, analysisWith(), 'Formal', composeTweak({ emphasise: 'the Salsita work' }), '', 'cs', new Date('2026-08-14'), voiceProfile)
      .map((m) => m.content).join('\n');

  // The four-clause contract is gone (2026-08-15). It was the rule stack's last
  // form and it lost to a four-line prompt. What replaced it is a PURPOSE and a
  // single absolute, and the deterministic checks that mattered (language,
  // steering, employer named, word band) still run in utils/cv-validate.js —
  // enforcement moved to code, which is where it worked all along.
  test('the purpose replaces the contract, and the one absolute is stated', () => {
    const p = promptText();
    expect(p).toMatch(/decides to call this person for an interview/);
    expect(p).toMatch(/never invent, never inflate/);
    expect(p).not.toMatch(/C1 —/);
    expect(p).not.toMatch(/THE CONTRACT/);
  });

  // The PURPOSE now leads, and the contract follows it — the letter exists to
  // persuade, and a model reading rules first writes a compliant letter
  // (CV_RULES.md, "What the cover letter IS"). Nothing else may come before
  // them: the ordering is what keeps the rule stack from owning the document.
  test('the purpose leads the prompt — nothing is stated before it', () => {
    const user = buildCoverPrompt(MASTER, analysisWith(), 'Formal', '', '', 'auto').at(-1).content;
    const purpose = user.indexOf('# What this letter is for');
    expect(purpose).toBeGreaterThan(-1);
    // Only Nik's own two-line brief precedes it.
    expect(user.slice(0, purpose)).toMatch(/^Write a tailored cover letter/);
    // The four measured moves reach the writer.
    expect(user).toMatch(/Answer what the ad says it does NOT want/);
    expect(user).toMatch(/Open on THEIR problem/);
    expect(user).toMatch(/Relevance beats recency/);
    expect(user).toMatch(/Let the ad set the shape/);
  });

  // C3's fallback: no voice profile is not permission to write like a brochure.
  test('with no voice profile the letter is still told to write like a person', () => {
    const p = promptText();
    expect(p).toMatch(/vary the sentence lengths deliberately/);
    expect(p).toMatch(/go genuinely short at least once/);
  });

  test('with a voice profile the recorded voice owns the letter from the first sentence', () => {
    const p = buildCoverPrompt(MASTER, analysisWith(), 'Formal', '', '', 'auto', new Date(), {
      list_a: ['leads with the point'],
      samples: [{ text: 'I shipped it on a Tuesday. It worked.' }],
    }).at(-1).content;
    expect(p).toMatch(/YOU ARE WRITING AS THIS CANDIDATE, IN THEIR VOICE/);
    expect(p).toMatch(/leads with the point/);
    expect(p).toMatch(/I shipped it on a Tuesday/);
    expect(p).toMatch(/Voice is SHAPE before it is vocabulary/);
  });

  // Stated ONCE: the language instruction used to appear in the Task block as
  // well, which is the repetition the contract replaced.
  test('the output language is stated exactly once', () => {
    const text = promptText();
    const hits = text.match(/OUTPUT LANGUAGE \(overrides/g) || [];
    expect(hits).toHaveLength(1);
  });
});
