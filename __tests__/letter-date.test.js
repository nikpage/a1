// __tests__/letter-date.test.js
//
// The two-dates defect, in the languages this product actually ships in.
//
// generateCoverLetter prepends today's date to the letter, so dressLetter must
// first strip the date the model wrote for itself. Its month list was English
// only — so a Czech letter dating itself "13. srpna 2026" kept that line, got
// "13.08.2026" prepended above it, and went out with two dates. The English
// day-first form was fixed once before; the same bug in cs/pl was left standing.
//
// Calls the real dressLetter. No mocks — it is a pure string function.

import { describe, test, expect } from 'vitest';
import { dressLetter } from '../utils/openai.js';

const SALUTATION = 'Vážený pane Nováku,';
const body = (date) => `${date}\n\n${SALUTATION}\n\nText dopisu.`;

// dressLetter strips the model's date and prepends today's, so a correct result
// carries EXACTLY ONE date line: the one dressLetter put there.
const dateLines = (text) => text.split('\n').map((l) => l.trim()).filter((l) => /\d{4}/.test(l) && !/[a-zA-Zá-žÁ-Ž]{4}/.test(l.replace(/ledna|února|března|dubna|května|června|července|srpna|září|října|listopadu|prosince|stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia|january|february|march|april|may|june|july|august|september|october|november|december/gi, '')));

describe('dressLetter strips the model’s own date line', () => {
  test.each([
    ['13. srpna 2026', 'cs — genitive month, the form the letter actually used'],
    ['1. ledna 2026', 'cs — start of year'],
    ['30. září 2026', 'cs — diacritics'],
    ['30. zari 2026', 'cs — diacritics stripped by an export path'],
    ['13. sierpnia 2026', 'pl'],
    ['5. października 2026', 'pl — diacritics'],
    ['13. 8. 2026', 'cs numeric, spaced'],
    ['13.08.2026', 'numeric'],
    ['13 August 2026', 'en day-first'],
    ['August 13, 2026', 'en month-first'],
    ['2026-08-13', 'iso'],
  ])('%s (%s)', (date) => {
    const out = dressLetter(body(date));
    // Exactly one date line is the whole point: the model's own date is gone
    // and only the one dressLetter prepends remains. (A numeric date that
    // happens to equal today's is indistinguishable by text, so the count is
    // what the assertion rests on.)
    expect(dateLines(out)).toHaveLength(1);
    expect(out.indexOf(SALUTATION)).toBeGreaterThan(-1);
    expect(out).toContain('Text dopisu.');
  });

  test('a date INSIDE the letter is left alone — only leading lines are dates', () => {
    const out = dressLetter(`${SALUTATION}\n\nOd 13. srpna 2026 jsem k dispozici.`);
    expect(out).toContain('Od 13. srpna 2026 jsem k dispozici.');
  });

  test('a letter with no date of its own still gets exactly one', () => {
    const out = dressLetter(`${SALUTATION}\n\nText dopisu.`);
    expect(dateLines(out)).toHaveLength(1);
  });
});
