// utils/master-issues.js
//
// Deterministic detector for the master-profile step (no AI). Any MODEL that reads
// the master reconciles it and reports "clean" — it sanitizes away the very gaps
// and overlaps we need the user to explain. So we don't ask a model: we do plain
// arithmetic on the verbatim `dates` strings each experience entry keeps. Math
// doesn't sanitize, so the issues are always findable.
//
// We surface only the issues whose ANSWER the future CV builder will need and
// cannot infer — and only when the user hasn't already answered them:
//   - overlap     : an ongoing role (…–Present) running across other roles
//                   (e.g. a consultancy spanning employed stints). Concurrent, or
//                   the umbrella those were delivered under? Only the user knows.
//   - short tenure: a sub-~1.5-year role that a recruiter stops on — why it ended.
//   - gap         : an uncovered stretch in the recent timeline — what happened.
//
// Each issue is a `clarify` flag the existing Flag Fixer + /api/resolve-flag path
// already understand: answering writes a `clarification` note onto that role
// (utils/master-flags applyClarification). Because resolution sets that note, a
// re-scan skips anything already answered — the scan is idempotent.

import { roles } from './master-read.js';

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const PRESENT = /^(present|current|now|ongoing|to date|date)$/i;

// Issue thresholds.
const SHORT_TENURE_MAX_MONTHS = 17;  // under ~1.5 years reads as a short stint
const GAP_MIN_MONTHS = 6;            // an uncovered stretch worth explaining
const RECENT_WINDOW_YEARS = 15;      // older roles rarely reach a future CV — don't ask

// Age/gender-neutral reasons — never assume life stage or gender.
const TENURE_OPTIONS = [
  'Contract / fixed-term role ended',
  'Company restructuring / layoff',
  'Moved to a better opportunity',
  'Relocation',
  'Health or family reasons',
];
const GAP_OPTIONS = [
  'Between roles / job searching',
  'Parental / caregiver leave',
  'Health or family reasons',
  'Study / retraining',
  'Travel / personal project',
];

// Parse one endpoint ("November 2022", "2022", "Present") into a comparable
// month index (year*12 + month-1), plus whether it was month-precise. Returns
// null when unreadable so we never fabricate a span.
function parseEndpoint(raw, { isEnd }) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (PRESENT.test(s)) return { index: null, present: true, monthPrecise: true };

  // "November 2022" / "Nov 2022" / "2022 November"
  const mY = s.match(/([A-Za-z]+)\.?\s+(\d{4})/) || s.match(/(\d{4})\s+([A-Za-z]+)/);
  if (mY) {
    const monthWord = (mY[1].match(/[A-Za-z]+/) ? mY[1] : mY[2]).toLowerCase();
    const year = parseInt(mY[1].match(/\d{4}/) ? mY[1] : mY[2], 10);
    const mo = MONTHS[monthWord];
    if (mo && year) return { index: year * 12 + (mo - 1), present: false, monthPrecise: true };
  }

  // Numeric "11/2022" or "2022-11"
  const num = s.match(/(\d{1,2})[\/.\-](\d{4})/) || s.match(/(\d{4})[\/.\-](\d{1,2})/);
  if (num) {
    const a = parseInt(num[1], 10);
    const b = parseInt(num[2], 10);
    const year = a > 12 ? a : b;
    const mo = a > 12 ? b : a;
    if (year > 1900 && mo >= 1 && mo <= 12) return { index: year * 12 + (mo - 1), present: false, monthPrecise: true };
  }

  // Year only — coarse. Span the whole year: start=Jan, end=Dec.
  const y = s.match(/\b(\d{4})\b/);
  if (y) {
    const year = parseInt(y[1], 10);
    return { index: year * 12 + (isEnd ? 11 : 0), present: false, monthPrecise: false };
  }
  return null;
}

// Parse a verbatim dates string into { start, end, ongoing, monthPrecise }.
// Splits on dash/en-dash/em-dash or the word "to". Returns null if either
// endpoint is unreadable.
function parseSpan(dates, nowIndex) {
  const s = String(dates || '').trim();
  if (!s) return null;
  const parts = s.split(/\s*(?:[-–—]|\bto\b)\s*/i).filter(Boolean);

  let startRaw;
  let endRaw;
  if (parts.length >= 2) {
    startRaw = parts[0];
    endRaw = parts[parts.length - 1];
  } else {
    startRaw = parts[0];
    endRaw = parts[0]; // single token like "2011" — a one-year span
  }

  const start = parseEndpoint(startRaw, { isEnd: false });
  const end = parseEndpoint(endRaw, { isEnd: true });
  if (!start || !end) return null;
  if (start.present) return null; // a start of "Present" is meaningless

  const ongoing = !!end.present;
  const endIndex = ongoing ? nowIndex : end.index;
  if (endIndex == null || start.index == null) return null;

  return {
    start: start.index,
    end: endIndex,
    ongoing,
    startPrecise: start.monthPrecise,
    endPrecise: ongoing ? true : end.monthPrecise,
  };
}

function rolesOverlap(a, b) {
  // Overlap length in months; require ≥2 so a touching boundary (one role ends
  // the same month another starts) isn't treated as concurrency.
  const lo = Math.max(a.start, b.start);
  const hi = Math.min(a.end, b.end);
  return hi - lo >= 2;
}

function roleLabel(entry) {
  const role = entry?.role || 'this role';
  const company = entry?.company ? ` at ${entry.company}` : '';
  return `${role}${company}`;
}

// `role_overlaps` indexes into `master.work_experience`; every flag targets a
// position in the FLAT list `roles()` produces (umbrella entries and their
// nested engagements alike). This maps one to the other: a top-level entry sits
// after every engagement nested under the entries before it.
function flatIndexes(master) {
  const out = [];
  let flat = 0;
  const top = Array.isArray(master?.work_experience) ? master.work_experience : [];
  for (const entry of top) {
    out.push(flat);
    flat += 1 + (Array.isArray(entry?.fractional_engagements) ? entry.fractional_engagements.length : 0);
  }
  return out;
}

// The open overlap questions, as flags the Flag Fixer renders like any other.
// Answering one is applied by applyOverlapAnswer() (utils/master-schema) — the
// only thing in the app that nests a role — through /api/resolve-flag.
function overlapQuestions(master, experience) {
  const overlaps = Array.isArray(master?.role_overlaps) ? master.role_overlaps : [];
  const top = Array.isArray(master?.work_experience) ? master.work_experience : [];
  const flat = flatIndexes(master);
  const out = [];
  overlaps.forEach((o, i) => {
    if (!o || o.answer) return;
    const role = top[o.role_index];
    const umbrella = top[o.umbrella_index];
    if (!role || !umbrella) return;
    const index = flat[o.role_index];
    const entry = experience[index];
    if (!entry) return;
    const practice = umbrella.company || 'your own practice';
    out.push({
      id: `overlap-${i}`,
      type: 'overlap',
      kind: 'overlap',
      // Which `role_overlaps` question this is — what the server answers. The
      // client never sends indexes of its own; they are re-read from the record.
      question_index: i,
      target: { section: 'experience', index },
      question: `Your ${roleLabel(entry)} (${entry.dates}) ran while ${practice} was active. Was it client work delivered under ${practice}, or a separate job?`,
      options: [`Client work under ${practice}`, 'A separate job'],
      // What each option means to applyOverlapAnswer, in option order.
      answers: ['nested', 'separate'],
    });
  });
  return out;
}

// The stored `gen_data.content` column holds the analysis as a JSON STRING (the
// background function always JSON.stringify()s before insert — see
// netlify/functions/analyse-background.mjs). Callers (get-analysis.js,
// resolve-flag.js) load it via getLatestAnalysis() and must hand computeMasterIssues
// a parsed object; this helper is the single place that does that parsing so both
// routes treat "string or already-object" identically. Never throws — a malformed
// or absent value degrades to null (context-free issues), never a 500.
export function parseAnalysisContent(content) {
  if (!content) return null;
  if (typeof content === 'object') return content;
  if (typeof content !== 'string') return null;
  try {
    const obj = JSON.parse(content);
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Analysis-assisted enrichment (TASK 2): the teaser analysis already noticed the
// same overlaps/gaps/short-tenures and wrote about them in plain English
// (analysis.scan_snags, hr_first_seconds, nuance_clarifications, red_flags). We
// match those sentences to an issue by company/role/date substring — purely
// textual, no AI, no fabrication. A non-match leaves the issue exactly as it was.
// ---------------------------------------------------------------------------

// Pull every candidate sentence out of the stored analysis object, most specific
// first. `analysisContent` is the full parsed gen_data payload (has a nested
// `.analysis` block); also accept the sub-object directly for callers that
// already unwrapped it.
function collectAnalysisSnippets(analysisContent) {
  try {
    const a = analysisContent?.analysis && typeof analysisContent.analysis === 'object'
      ? analysisContent.analysis
      : analysisContent;
    if (!a || typeof a !== 'object') return [];
    const out = [];
    if (Array.isArray(a.scan_snags)) {
      for (const s of a.scan_snags) {
        const t = [s?.point, s?.detail].filter((x) => typeof x === 'string' && x.trim()).join(' — ').trim();
        if (t) out.push(t);
      }
    }
    if (typeof a.hr_first_seconds === 'string' && a.hr_first_seconds.trim()) {
      out.push(a.hr_first_seconds.trim());
    }
    if (Array.isArray(a.nuance_clarifications)) {
      for (const t of a.nuance_clarifications) if (typeof t === 'string' && t.trim()) out.push(t.trim());
    }
    if (Array.isArray(a.red_flags)) {
      for (const t of a.red_flags) if (typeof t === 'string' && t.trim()) out.push(t.trim());
    }
    return out;
  } catch {
    return [];
  }
}

// All 4-digit years in a verbatim dates string, deduped.
function yearsOf(dates) {
  const matches = String(dates || '').match(/\d{4}/g) || [];
  return [...new Set(matches)];
}

// Does this sentence talk about THIS experience entry? Company/role substring,
// or every year in the entry's dates appearing in the sentence.
function snippetMatchesEntry(snippetLower, entry) {
  const company = String(entry?.company || '').trim();
  const role = String(entry?.role || '').trim();
  if (company.length > 2 && snippetLower.includes(company.toLowerCase())) return true;
  if (role.length > 2 && snippetLower.includes(role.toLowerCase())) return true;
  const yrs = yearsOf(entry?.dates);
  if (yrs.length > 0 && yrs.every((y) => snippetLower.includes(y))) return true;
  return false;
}

// A sentence that explicitly says the ambiguity is ALREADY settled (not merely
// described) — conservative on purpose: only drop the question on an unambiguous
// "this isn't actually an issue" cue.
const RESOLVED_CUE = /already explain|not a (?:real |genuine )?(?:gap|concern|issue|red flag)|no (?:real |genuine )?gap|non-issue/i;

// Does the sentence contain one of the deterministic reason options verbatim?
// If so, that's the confident suggestion — never a paraphrase, never invented.
function suggestForClarify(text, options) {
  const low = text.toLowerCase();
  for (const opt of options) {
    if (low.includes(opt.toLowerCase())) return opt;
  }
  return null;
}

// Attach { context, suggestion } to issues from the analysis text, and drop any
// issue an unambiguous cue says is already settled. Never throws: any failure
// here leaves `issues` completely unchanged.
function enrichWithAnalysis(issues, experience, analysisContent) {
  const snippets = collectAnalysisSnippets(analysisContent);
  if (snippets.length === 0) return issues;

  const out = [];
  for (const issue of issues) {
    try {
      const indexes = [issue.target.index];
      const entries = indexes.map((i) => experience[i]).filter(Boolean);
      if (entries.length === 0) {
        out.push(issue);
        continue;
      }

      const matched = snippets.find((sn) => {
        const low = sn.toLowerCase();
        return entries.some((e) => snippetMatchesEntry(low, e));
      });

      if (!matched) {
        out.push(issue);
        continue;
      }
      if (RESOLVED_CUE.test(matched)) {
        continue; // dropped — the analysis already settled this one
      }

      const next = { ...issue, context: matched };
      const suggestion = suggestForClarify(matched, issue.kind === 'short_tenure' ? TENURE_OPTIONS : GAP_OPTIONS);
      if (suggestion) next.suggestion = suggestion;
      out.push(next);
    } catch {
      out.push(issue); // never let a matching failure drop or corrupt an issue
    }
  }
  return out;
}

// Compute the open clarify questions for a master. Pure: no network, no AI, no
// clock dependency beyond `now` (injected for testability; defaults to today).
//
// Second arg accepts either a Date (legacy call shape, still used by every
// existing caller/test) or an options object { now, analysis }. `analysis` is
// the parsed gen_data analysis payload (see parseAnalysisContent) — when
// supplied, issues get textually-matched `context`/`suggestion` fields (TASK 2).
export function computeMasterIssues(master, opts = {}) {
  const isDateArg = opts instanceof Date;
  const now = isDateArg ? opts : (opts?.now instanceof Date ? opts.now : new Date());
  const analysisContent = isDateArg ? null : (opts?.analysis || null);

  // The flat role list, umbrella entries and their engagements alike. An index
  // into it is stable for the life of one record: roles() walks the record in
  // order, so the same record always yields the same positions.
  const experience = roles(master);
  const clarifications = Array.isArray(master?.clarifications) ? master.clarifications : [];
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  const cutoff = (now.getFullYear() - RECENT_WINDOW_YEARS) * 12; // older than this: don't ask

  // Parse every role once; keep original index so flag targets stay valid.
  const spans = experience.map((entry, index) => {
    const span = parseSpan(entry?.dates, nowIndex);
    return span ? { ...span, index, entry } : null;
  });

  const recent = spans.filter((s) => s && s.end >= cutoff);

  // --- Coverage set: every role geometrically overlapped by an ongoing role ----
  // Computed regardless of whether the overlap question is answered, so a role
  // explained by an ongoing umbrella is never ALSO short-tenure-flagged, on this
  // scan or any re-scan.
  const ongoing = recent.filter((s) => s.ongoing);

  const issues = [];
  // A question is answered when the user's own note for that role is stored.
  // Notes live in a top-level `clarifications` array rather than on the role:
  // the role objects are what the extraction writes, and a user answer sitting
  // inside one would be read as record content by everything downstream.
  const answered = (i) => clarifications.some((c) => c && c.index === i && String(c.note || '').trim());

  // --- Overlaps: asked from the RECORD, never from date arithmetic ------------
  // The build reports every role whose dates fall inside the person's own
  // practice in `master.role_overlaps` and nests nothing. Those pairs are the
  // question, so this scan reads them rather than re-deriving concurrency from
  // the `dates` strings: two systems asking the same thing off two different
  // sources is how /me ended up with two question panels. One list, one source.
  for (const q of overlapQuestions(master, experience)) issues.push(q);

  // A role whose overlap is still open is explained by that pending answer —
  // don't also ask why the stint was short until it is settled.
  const suppressedShort = new Set(
    issues.filter((i) => i.kind === 'overlap').map((i) => i.target.index),
  );
  // An engagement nested under an umbrella is explained BY that nesting: its
  // short span is the shape of client work, not a tenure to answer for.
  experience.forEach((r, i) => { if (r.via) suppressedShort.add(i); });

  // --- Short tenure → one clarify on the role ---------------------------------
  for (const s of recent) {
    if (s.ongoing) continue;
    if (!(s.startPrecise && s.endPrecise)) continue; // year-only is too coarse to call "short"
    if (suppressedShort.has(s.index)) continue; // its overlap is still unanswered — settle that first
    if (s.end - s.start >= SHORT_TENURE_MAX_MONTHS) continue;
    if (answered(s.index)) continue;
    const months = s.end - s.start;
    issues.push({
      id: `short-${s.index}`,
      type: 'clarify',
      kind: 'short_tenure',
      target: { section: 'experience', index: s.index },
      question: `Your ${roleLabel(s.entry)} (${s.entry?.dates}) lasted about ${months} month${months === 1 ? '' : 's'}. Why did it end?`,
      options: TENURE_OPTIONS,
    });
  }

  // --- Gaps: uncovered stretches in the recent timeline -----------------------
  // Merge all recent spans; a gap is an uncovered interval between merged blocks.
  const sorted = [...recent].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end + 1) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ start: s.start, end: s.end });
    }
  }
  for (let i = 1; i < merged.length; i++) {
    const gapMonths = merged[i].start - merged[i - 1].end;
    // The role that STARTS after the gap (the return-to-work) and the role whose
    // end bounds the gap on the earlier side.
    const after = sorted.find((s) => s.start === merged[i].start);
    const before = sorted.find((s) => s.end === merged[i - 1].end);
    // Year-only boundaries round to Jan/Dec, which can fabricate a sub-year hole
    // between consecutive years. Demand a clear >1-year gap unless both bounding
    // dates are month-precise.
    const coarse = !before?.endPrecise || !after?.startPrecise;
    const threshold = coarse ? 18 : GAP_MIN_MONTHS;
    if (gapMonths < threshold) continue;
    if (!after || answered(after.index)) continue;
    const years = Math.round((gapMonths / 12) * 10) / 10;
    const span = years >= 1 ? `${years} year${years === 1 ? '' : 's'}` : `${gapMonths} months`;
    issues.push({
      id: `gap-${after.index}`,
      type: 'clarify',
      kind: 'gap',
      target: { section: 'experience', index: after.index },
      question: `There's roughly a ${span} gap before your ${roleLabel(after.entry)} (${after.entry?.dates}). What happened in that time?`,
      options: GAP_OPTIONS,
    });
  }

  // Rank: a gap is the bigger question a reader has, so it is asked first.
  // An overlap is structural: answering it can move a role out of the timeline
  // and settle the questions behind it, so it is asked first.
  const KIND_RANK = { overlap: -1, gap: 0, short_tenure: 1 };
  const ordered = [...issues].sort((a, b) => (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9));

  if (!analysisContent) return ordered;
  try {
    return enrichWithAnalysis(ordered, experience, analysisContent);
  } catch {
    return ordered; // a matching failure must never break the base issue list
  }
}
