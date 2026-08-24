// Form-free measurement of a finished cover letter.
//
// Every check here is a property that must hold whatever SHAPE the letter takes.
// The shape is the writer's to choose per ad (CV_RULES.md, "the letter is
// COMPOSED, not executed"), so nothing in this file counts paragraphs, fixes an
// order, or expects a move in a given place. What it measures is what separated
// the one letter Nik judged good from the nineteen he rejected on 2026-08-23.
//
// It measures; it does not judge prose. A letter can pass everything here and
// still be a bad letter.

import { coverBody, coverShape, coverBreadthFault, bannedPhraseHits } from './cv-validate.js';

const SENT = /[^.!?…]+[.!?…]+/g;

function sentences(body) {
  return (body.match(SENT) || []).map((s) => s.trim()).filter(Boolean);
}

function words(s) {
  return s.split(/\s+/).filter(Boolean);
}

// The letter is an application, written by a person about themselves. A letter
// with no "I" in it is a brochure — the defect the writing prompt names first.
const FIRST_PERSON = /\b(I|I'm|I've|I'd|I'll|my|me|mine)\b/gi;

// Speech, not business prose. Nik's own letter carries "I've", "it's",
// "doesn't", "I'd". Every rejected run that read as a machine carried none.
const CONTRACTION = /\b\w+['’](s|t|re|ve|ll|d|m)\b/gi;

// A short declarative with no person in it and nothing concrete to hold onto is
// a slogan — "Friction kills adoption." It is what a model writes when it has
// nothing to say, and it was in the rejected runs, never in Nik's letter.
function slogans(body) {
  return sentences(body).filter((s) => {
    const w = words(s);
    if (w.length > 9 || w.length < 3) return false;
    if (FIRST_PERSON.test(s)) { FIRST_PERSON.lastIndex = 0; return false; }
    FIRST_PERSON.lastIndex = 0;
    // A proper noun means it is about something real, not an aphorism.
    return !w.slice(1).some((x) => /^[A-Z][a-z]/.test(x.replace(/[^\w+.]/g, '')));
  });
}

// The close has to be a thing a person would actually do next. "I look forward
// to discussing" is what every other applicant sends; "I'd love to buy you a
// coffee and talk" is an ask.
const STOCK_CLOSE = /(look forward to (hearing|discussing|the opportunity)|welcome the opportunity|would welcome the chance|at your earliest convenience|hope to hear from you)/i;
const REAL_ASK = /\b(coffee|call|talk|meet|walk you through|show you|sit down|half an hour|beer|lunch|chat)\b/i;

function closeFault(body) {
  const tail = body.trim().split(/\n+/).slice(-3).join(' ');
  if (STOCK_CLOSE.test(tail)) return 'stock close';
  if (!REAL_ASK.test(tail)) return 'no ask — nothing specific the reader is invited to do';
  return null;
}

// The ad's own job title in the letter is the template tell: the reader knows
// which job it is, and naming it is what a mail-merge does.
function titleEcho(body, jobTitle) {
  if (!jobTitle) return null;
  const t = jobTitle.trim().toLowerCase();
  if (t.length < 5) return null;
  return body.toLowerCase().includes(t) ? `names the job title verbatim ("${jobTitle}")` : null;
}

export function scoreLetter(document, { master = '', jobTitle = '', language = 'auto' } = {}) {
  const body = coverBody(document);
  const shape = coverShape(document);
  const faults = [];

  const fp = (body.match(FIRST_PERSON) || []).length;
  if (fp < 5) faults.push(`only ${fp} first-person words — this is not an application`);

  const contractions = (body.match(CONTRACTION) || []).length;
  if (contractions === 0) faults.push('no contractions anywhere — business prose, not speech');

  const breadth = coverBreadthFault(document, master);
  if (breadth) faults.push(breadth);

  const sl = slogans(body);
  if (sl.length) faults.push(`slogan: ${sl.map((s) => `"${s}"`).join(', ')}`);

  const close = closeFault(body);
  if (close) faults.push(close);

  const echo = titleEcho(body, jobTitle);
  if (echo) faults.push(echo);

  const stock = bannedPhraseHits(document, language);
  if (stock.length) faults.push(`stock phrasing: ${stock.join(', ')}`);

  return {
    ok: faults.length === 0,
    faults,
    measures: { words: words(body).length, firstPerson: fp, contractions, slogans: sl.length, ...shape },
  };
}
