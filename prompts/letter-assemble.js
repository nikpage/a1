// prompts/letter-assemble.js
//
// THE LETTER IS WRITTEN HERE, IN CODE — not by the model.
//
// The model returns which of Nik's paragraphs answer this ad (prompts/letter-library.js)
// and the opening stance where none of his openings fit. This file puts the
// document together: date, salutation, opening, two instances, the day-to-day
// line, the close, the signature block.
//
// The counterpart of prompts/cv-assemble.js, for the same reason: a shape stated
// in a prompt is a shape that gets ignored, and the letter's shape was stated in
// three places at once (the writing prompt, the plan pass, three exemplars) and
// still came back as one long paragraph stapled to a summarised one. There is no
// slot for that now.
//
// Contact details appear EXACTLY ONCE, in the signature block.

import {
  instanceById,
  openingById,
  dayToDayById,
  closeById,
  LANGUAGE_LINE
} from './letter-library.js';

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// His own date format, off the Sudolabs letter: 24.08.2026.
export function letterDate(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(now.getDate())}.${p(now.getMonth() + 1)}.${now.getFullYear()}`;
}

// A name only where the ad genuinely gave one. Never guessed, never a title.
export function salutation(contactName, language = 'en') {
  const name = str(contactName);
  if (!name) {
    if (language === 'cs') return 'Vážená paní, vážený pane,';
    if (language === 'pl') return 'Szanowni Państwo,';
    return 'Dear Hiring Team,';
  }
  return `Dear ${name},`;
}

const signOff = (language) =>
  language === 'cs' ? 'S pozdravem,' : language === 'pl' ? 'Z poważaniem,' : 'Sincerely,';

export function assembleCover(master, picked = {}, { now = new Date(), language = 'en' } = {}) {
  const p = master?.profile || {};

  // The opening is his where one of his fits, and the model's only where it
  // does not. `opening_text` is the single piece of generated prose in the
  // document.
  const opening = openingById(picked.opening)?.text || str(picked.opening_text);

  // BOTH instances print whole. His hand-written letters tell both out; the
  // "one carries, one is summarised" split is what the production prompt did
  // and it is what made the second half read as filler.
  const instances = (Array.isArray(picked.instances) ? picked.instances : [])
    .map((id) => instanceById(id)?.text)
    .filter(Boolean);

  const dayToDay = dayToDayById(picked.day_to_day)?.text || '';
  const close = closeById(picked.close)?.text || '';

  const body = [opening, ...instances, dayToDay].filter(Boolean);
  const closing = [close, picked.language_line ? LANGUAGE_LINE : ''].filter(Boolean).join(' ');

  // The record holds these under profile.contact — phone, email, LinkedIn, in
  // the order his own signature block prints them.
  const c = p.contact || {};
  const contact = [c.phone, c.email, c.linkedin, c.website].filter(Boolean);

  const doc = [
    letterDate(now),
    '',
    salutation(picked.contact_name, language),
    '',
    ...body.flatMap((para) => [para, '']),
    closing,
    '',
    signOff(language),
    '',
    `**${p.name || ''}**`,
    ...contact
  ];

  return doc.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
