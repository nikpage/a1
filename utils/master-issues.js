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

// Does the sentence propose "delivered under the umbrella" (merge) or "held
// separately" (separate) for an overlap issue?
function suggestForOverlap(text) {
  // Merge cues checked FIRST: a sentence can say "...delivered under X rather
  // than held separately" — the affirmative clause is the actual proposal, and
  // a bare "separat(e/ely)" can show up inside its own negation.
  if (/delivered under|held under|contracts? under|worked under/i.test(text)) return 'merge';
  if (/\bunder\b/i.test(text) && /(consultanc|engagement|umbrella|own business|own company)/i.test(text)) return 'merge';
  if (/separat/i.test(text)) return 'separate';
  return null;
}

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
      const indexes = issue.kind === 'overlap'
        ? [issue.target.index, ...(issue.merge?.child_indexes || [])]
        : [issue.target.index];
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
      const suggestion = issue.kind === 'overlap'
        ? suggestForOverlap(matched)
        : suggestForClarify(matched, issue.kind === 'short_tenure' ? TENURE_OPTIONS : GAP_OPTIONS);
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

  const experience = Array.isArray(master?.experience) ? master.experience : [];
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
  const answered = (i) => !!String(experience[i]?.clarification || '').trim();

  // --- Overlap (ongoing role spanning others) → a MERGE decision --------------
  // The ambiguity is the RELATIONSHIP, not the dates: are these roles delivered
  // UNDER the ongoing role, or held concurrently as separate jobs? Only the user
  // knows. We ask it as a structural merge — "add them under this" (they become
  // nested contracts and drop out of the timeline) vs "separate" (recorded as a
  // clarification on the ongoing role, which leaves the short stints standalone
  // and therefore still in need of their own explanation below).
  //
  // A child is suppressed from the short-tenure check ONLY while its overlap is
  // still OPEN. Once the user says "separate" (the ongoing role gets a
  // clarification), the suppression lifts and the short stints surface. Once
  // merged, the children are nested away and never scanned again.
  const suppressedShort = new Set();
  for (const o of ongoing) {
    const children = recent.filter((r) => r.index !== o.index && rolesOverlap(o, r));
    if (children.length === 0) continue;
    if (answered(o.index)) continue; // user already chose "separate" → don't re-ask, don't suppress
    children.forEach((c) => suppressedShort.add(c.index));
    const names = children.map((c) => c.entry?.company || c.entry?.role).filter(Boolean).join(', ');
    issues.push({
      id: `overlap-${o.index}`,
      type: 'structural',
      kind: 'overlap',
      target: { section: 'experience', index: o.index },
      question: `Your ${roleLabel(o.entry)} (${o.entry?.dates}) runs across ${children.length} other role${children.length === 1 ? '' : 's'}${names ? ` — ${names}` : ''}. Were those delivered under it, or held separately at the same time?`,
      merge: {
        parent: { company: o.entry?.company || '', role: o.entry?.role || '', dates: o.entry?.dates || '', location: o.entry?.location || '' },
        child_indexes: children.map((c) => c.index),
      },
    });
  }

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

  // Rank: overlap (structural, highest-leverage — answering it can remove the
  // gap/short-tenure questions below it) first, then gap, then short_tenure.
  const KIND_RANK = { overlap: 0, gap: 1, short_tenure: 2 };
  const ordered = [...issues].sort((a, b) => (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9));

  if (!analysisContent) return ordered;
  try {
    return enrichWithAnalysis(ordered, experience, analysisContent);
  } catch {
    return ordered; // a matching failure must never break the base issue list
  }
}
