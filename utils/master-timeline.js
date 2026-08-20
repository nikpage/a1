// utils/master-timeline.js
//
// THE TIMELINE, COUNTED IN CODE.
//
// The career profile kept reporting "apparent job-hopping — Salsita 11 months,
// wflow 10 months, BLOCKS 6 months" for a person who has held ONE thing since
// 2016: their own practice, with those three sitting inside it as client
// engagements. The record already nests them correctly and both prompts already
// carry a hard rule saying a nested engagement is not a job. The model read the
// rule and counted the children anyway, because it can see them and counting is
// what it does with a list.
//
// So it is not asked any more. This file computes the only timeline facts a
// standing risk may be built from — how many things the person actually held,
// how long each ran, and where the real gaps are — and the prompt is told those
// numbers are authoritative. Same pattern as splitProvenKeywords() and
// utils/master-issues.js: where a claim can be checked by arithmetic, arithmetic
// checks it.
//
// Nested engagements are rendered UNDER their parent, explicitly without a
// tenure of their own, so the model sees delivered work rather than a row in a
// list of employers.

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // Czech and Polish month names — this is an EU product and a Czech master
  // record writes "srpen 2016", not "August 2016".
  led: 1, úno: 2, uno: 2, bře: 3, bre: 3, dub: 4, kvě: 5, kve: 5, čer: 6, cer: 6,
  srp: 8, zář: 9, zar: 9, říj: 10, rij: 10, lis: 11, pro: 12,
  sty: 1, lut: 2, kwi: 4, maj: 5, cze: 6, lip: 7, sie: 8, wrz: 9, paź: 10, paz: 10, gru: 12,
};

const ONGOING = /present|current|now|dosud|obecnie|nadal/i;

// A date string → months since year 0, so two of them subtract into a duration.
// `end` decides what a year with no month means: a start defaults to January and
// an end to December, which is the reading that reports the FEWEST gaps. A gap
// this file reports is one the record really shows.
export function monthsFrom(text, end = false) {
  const s = typeof text === 'string' ? text.trim() : '';
  if (!s) return null;
  const year = (s.match(/\b(19|20)\d{2}\b/) || [])[0];
  if (!year) return null;
  let month = null;
  // 08/2016 and 2016-08 both occur in real records; take the month from
  // whichever side of the separator is not the year.
  const monthFirst = s.match(/\b(0?[1-9]|1[0-2])[./-](?:19|20)\d{2}\b/);
  const yearFirst = s.match(/\b(?:19|20)\d{2}[./-](0?[1-9]|1[0-2])\b/);
  if (monthFirst) month = Number(monthFirst[1]);
  else if (yearFirst) month = Number(yearFirst[1]);
  if (month === null) {
    const word = s.toLowerCase().match(/[a-zá-ž]{3,}/i);
    if (word) month = MONTHS[word[0].slice(0, 3)] ?? null;
  }
  if (month === null) month = end ? 12 : 1;
  return Number(year) * 12 + month;
}

function span(entry, now) {
  const nowMonths = now.getFullYear() * 12 + (now.getMonth() + 1);
  const raw = `${entry?.start_date || ''} ${entry?.end_date || ''} ${entry?.dates || ''}`;
  const ongoing = ONGOING.test(raw);
  const start = monthsFrom(entry?.start_date || entry?.dates, false);
  const end = ongoing ? nowMonths : monthsFrom(entry?.end_date || entry?.dates, true);
  return { start, end, ongoing };
}

function duration(months) {
  if (months === null || months < 0) return '';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y && m) return `${y} yr ${m} mo`;
  if (y) return `${y} yr`;
  return `${m} mo`;
}

function label(entry) {
  const company = (entry?.company || entry?.organization || '').trim();
  const title = (entry?.title || '').trim();
  return [company, title].filter(Boolean).join(' — ') || 'unnamed entry';
}

function dates(entry) {
  const from = (entry?.start_date || '').trim();
  const to = (entry?.end_date || '').trim();
  if (from && to) return `${from} - ${to}`;
  return from || to || (entry?.dates || '').trim() || 'no dates recorded';
}

// The facts, as data. `entries` is the list of things the person actually HELD —
// one per top-level record entry, each carrying its own engagements. `gaps` is
// every stretch over six months that NO entry and NO engagement covers.
export function timelineFacts(master, now = new Date()) {
  const top = Array.isArray(master?.work_experience) ? master.work_experience : [];
  const entries = [];
  const covered = [];

  for (const entry of top) {
    const s = span(entry, now);
    const nested = (Array.isArray(entry?.fractional_engagements) ? entry.fractional_engagements : [])
      .map((sub) => ({ label: label(sub), dates: dates(sub) }));
    entries.push({
      label: label(entry),
      dates: dates(entry),
      months: s.start !== null && s.end !== null ? s.end - s.start : null,
      ongoing: s.ongoing,
      engagements: nested,
    });
    // An engagement's own span still counts as COVERAGE — a gap is a stretch
    // where the person did nothing, and client work is not nothing.
    for (const e of [entry, ...(entry?.fractional_engagements || [])]) {
      const es = span(e, now);
      if (es.start !== null && es.end !== null && es.end >= es.start) covered.push([es.start, es.end]);
    }
  }

  covered.sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let reach = null;
  for (const [start, end] of covered) {
    if (reach !== null && start - reach > 6) gaps.push({ months: start - reach, from: reach, to: start });
    reach = reach === null ? end : Math.max(reach, end);
  }

  return { entries, gaps };
}

function monthLabel(m) {
  return `${String(((m - 1) % 12) + 1).padStart(2, '0')}/${Math.floor((m - 1) / 12)}`;
}

// The block the prompt carries. Empty string when there is no parseable record,
// so a prompt never states a fact this file could not compute.
export function timelineBlock(master, now = new Date()) {
  const { entries, gaps } = timelineFacts(master, now);
  if (!entries.length) return '';

  const lines = entries.map((e) => {
    const d = e.months !== null ? ` (${duration(e.months)}${e.ongoing ? ', ongoing' : ''})` : '';
    const head = `- ${e.label} | ${e.dates}${d}`;
    if (!e.engagements.length) return head;
    const kids = e.engagements
      .map((k) => `    · delivered under it: ${k.label} | ${k.dates} — NOT a separate position, NOT a tenure`)
      .join('\n');
    return `${head} — ONE position, with ${e.engagements.length} client engagement${e.engagements.length === 1 ? '' : 's'} delivered under it\n${kids}`;
  });

  const gapLine = gaps.length
    ? gaps.map((g) => `- ${monthLabel(g.from)} → ${monthLabel(g.to)} (${duration(g.months)})`).join('\n')
    : '- none over six months';

  return `TIMELINE — COMPUTED FROM THIS RECORD IN CODE. AUTHORITATIVE. Do not recount it.
Positions actually held: ${entries.length}. Each line is one position; an indented engagement is work delivered inside the position above it and has no tenure of its own.
${lines.join('\n')}

Gaps in the record (no position and no engagement running):
${gapLine}

Every claim you make about tenure, stability, hopping, gaps or the number of employers MUST come from the numbers above. Counting indented engagements as jobs, short stints or a pattern of job-hopping is a factual error about this person.`;
}
