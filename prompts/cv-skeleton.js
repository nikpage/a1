// prompts/cv-skeleton.js
//
// The CV's STRUCTURE, built in code from the record — not asked for in a prompt.
//
// Seven rounds of prompting on 2026-08-25 could not get the writer to produce
// MM/YYYY dates, keep the client engagements nested under Nik Page Ltd., or hold
// a fifteen-year window; the production prompt already states all three in plain
// English and the app's own run that day dissolved every engagement into the
// parent's bullets anyway, burying the client names the employer scans for.
//
// A rule the writer can break is a rule that gets broken. So the skeleton is
// emitted here: which entries appear, in what order, under which parent, with
// which dates, and which roles collapse into an undated Earlier Career line. The
// writer receives it filled in and writes ONLY the bullets. Dissolving an
// engagement is then not a rule it disobeys — there is no slot for it.
//
// Nothing here interprets. Every title, employer and date is copied from the
// record verbatim; the only transformation is the DATE FORMAT (T2 permits
// normalising the format and forbids changing a date) and the choice of which
// roles fall outside the recency window, which is arithmetic.

const MONTHS = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

// "August 2016" -> "08/2016". A bare year stays a bare year: inventing a month
// to complete the pattern would be changing a date, not reformatting one.
// Anything unrecognised is passed through untouched rather than guessed at.
export function formatDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^present$/i.test(raw)) return 'Present';
  if (/^\d{4}$/.test(raw)) return raw;
  if (/^\d{2}\/\d{4}$/.test(raw)) return raw;
  const m = raw.match(/^([A-Za-zěščřžýáíéúůňťď]+)\s+(\d{4})$/i);
  if (m) {
    const mm = MONTHS[m[1].toLowerCase()];
    if (mm) return `${mm}/${m[2]}`;
  }
  const iso = raw.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[2]}/${iso[1]}`;
  return raw;
}

export function dateRange(start, end) {
  const a = formatDate(start);
  const b = formatDate(end) || 'Present';
  if (!a) return b;
  return `${a} - ${b}`;
}

// When a role ended, as a timestamp, for the recency window. An ongoing role
// counts as now. A bare year is read as its December, so a role dated only
// "2011" is not pushed out of the window by an accident of formatting.
function endTime(role, now) {
  const end = String(role?.end_date || '').trim();
  if (!end || /^present$/i.test(end)) return now.getTime();
  const mm = end.match(/^([A-Za-zěščřžýáíéúůňťď]+)\s+(\d{4})$/i);
  if (mm && MONTHS[mm[1].toLowerCase()]) return Date.UTC(Number(mm[2]), Number(MONTHS[mm[1].toLowerCase()]) - 1, 28);
  const y = end.match(/(\d{4})/);
  return y ? Date.UTC(Number(y[1]), 11, 31) : now.getTime();
}

/**
 * Split the record's roles into the dated recent block and the undated Earlier
 * Career list, keeping every nested engagement with its parent.
 *
 * The window is measured from the current year, not from the most recent role,
 * so a candidate between jobs does not silently gain a longer window.
 */
export function buildSkeleton(master, { now = new Date(), windowYears = 15, roster = null } = {}) {
  const roles = Array.isArray(master?.work_experience) ? master.work_experience : [];
  // Measured as a DATE, not a year: a bare year cutoff let a role that ended in
  // March 2011 sit in a "fifteen year" window that was really sixteen years deep.
  const cutoff = Date.UTC(now.getUTCFullYear() - windowYears, now.getUTCMonth(), now.getUTCDate());

  const recent = [];
  const earlier = [];

  for (const role of roles) {
    const entry = {
      title: String(role?.title || '').trim(),
      company: String(role?.company || '').trim(),
      location: String(role?.location || '').trim(),
      dates: dateRange(role?.start_date, role?.end_date),
      engagements: (Array.isArray(role?.fractional_engagements) ? role.fractional_engagements : []).map((e) => ({
        title: String(e?.title || '').trim(),
        company: String(e?.company || e?.client || '').trim(),
        dates: dateRange(e?.start_date, e?.end_date),
      })),
    };
    // A parent whose own span reaches into the window keeps its engagements
    // whatever their dates: they are evidence under a role that is still current.
    if (endTime(role, now) >= cutoff) recent.push(entry);
    // Earlier Career carries "Title, Employer" per CV_RULES.md Layer 1 — the
    // title is what tells the reader which of a decade's roles is worth the
    // line, and the roster below chooses which ones appear at all.
    else earlier.push({ title: entry.title, company: entry.company, location: entry.location });
  }

  return { recent, earlier: rosterOrder(earlier, roster), cutoff };
}

/**
 * The Earlier Career section, in the ANALYSIS's order and no longer than six.
 *
 * CV_RULES.md Layer 1: which roles appear is decided by the analysis, not by
 * the writer and not by recency — the section exists so a recognisable employer
 * survives the window, and printing the ten most recent lost Morgan Stanley and
 * Wells Fargo on a finance application. Each roster item is the string
 * "Title, Employer"; it is matched back to the real role rather than trusted as
 * text, so a roster entry naming a role the record does not hold is dropped.
 *
 * With no roster — an older analysis, a standalone run — the first six stand,
 * which is the cap either way.
 */
const MAX_EARLIER = 6;

function rosterOrder(earlier, roster) {
  const wanted = (Array.isArray(roster) ? roster : []).map((r) => String(r || '').toLowerCase());
  if (!wanted.length) return earlier.slice(0, MAX_EARLIER);

  const ordered = [];
  for (const want of wanted) {
    const hit = earlier.find((e) => !ordered.includes(e) && want.includes(e.company.toLowerCase()));
    if (hit) ordered.push(hit);
    if (ordered.length === MAX_EARLIER) break;
  }
  return ordered;
}

// One Earlier Career bullet: "Title, Employer" plus " — Location" where the
// master records one (CV_RULES.md Layer 1, "Earlier Career form"). No dates, no
// achievements — a bullet describing the work is a Work Experience entry
// smuggled past the recency window.
export function earlierLine(entry) {
  const head = [entry?.title, entry?.company].map((v) => String(v || '').trim()).filter(Boolean).join(', ');
  const loc = String(entry?.location || '').trim();
  return loc ? `${head} — ${loc}` : head;
}

// The bullet ceiling for a top-level role by its position, mirroring Layer 6
// check 6 exactly: the first two roles carry up to five, everything after up to
// three. It is a CEILING, not a quota — a thin entry prints fewer.
export function bulletCeiling(index) {
  return index < 2 ? 5 : 3;
}

// A stable key for one entry, used to marry the writer's bullets back to the
// slot they belong in. Employer plus dates: a person can hold the same title
// twice at the same company, but not over the same span.
export function entryKey(company, dates) {
  return `${company} | ${dates}`;
}

/**
 * Every slot the writer must supply bullets for, in document order, flattened
 * so the writer answers a list rather than reproducing a tree.
 */
export function skeletonSlots(skeleton) {
  const slots = [];
  (skeleton?.recent || []).forEach((r, i) => {
    slots.push({ key: entryKey(r.company, r.dates), title: r.title, company: r.company, dates: r.dates, max: bulletCeiling(i) });
    for (const e of r.engagements) {
      slots.push({ key: entryKey(e.company, e.dates), title: e.title, company: e.company, dates: e.dates, max: bulletCeiling(i) });
    }
  });
  return slots;
}

/**
 * ASSEMBLE the Work Experience section from the record and the writer's bullets.
 *
 * This is the point of the whole module. Given `bullets` as `{ [key]: string[] }`
 * the markdown is written HERE — headings, employers, dates, nesting depth and
 * the Earlier Career line are never the model's to choose, so it cannot dissolve
 * an engagement into a parent's bullets, re-date an entry or drop a heading. Two
 * runs on 2026-08-25 proved it does all three when merely instructed not to,
 * once with the structure written out verbatim in the prompt.
 *
 * A slot with no bullets still prints its heading: the record says the job
 * happened, and silence about it is not the writer's call.
 */
export function renderWorkExperience(skeleton, bullets = {}) {
  if (!skeleton?.recent?.length) return '';
  const out = [];
  const lines = (key) => (Array.isArray(bullets[key]) ? bullets[key] : []).map((b) => String(b).trim()).filter(Boolean);

  skeleton.recent.forEach((r, i) => {
    const ceiling = bulletCeiling(i);
    out.push(`#### **${r.title}**`);
    out.push(`**${r.company}** | ${r.dates}${r.location ? ` | ${r.location}` : ''}`);
    // The ceiling is stated in the prompt AND enforced here: a writer told a
    // limit is a writer that can exceed it, and on 2026-08-25 one wrote 14
    // bullets against a ceiling of 5. The surplus is dropped from the END —
    // the writer was asked for them most-relevant-first.
    for (const b of lines(entryKey(r.company, r.dates)).slice(0, ceiling)) out.push(`- ${b}`);
    out.push('');
    for (const e of r.engagements) {
      out.push(`##### **${e.title}** · ${e.company} | ${e.dates}`);
      for (const b of lines(entryKey(e.company, e.dates)).slice(0, ceiling)) out.push(`- ${b}`);
      out.push('');
    }
  });

  if (skeleton.earlier.length) {
    out.push('#### **Earlier Career**');
    for (const e of skeleton.earlier) out.push(`- ${earlierLine(e)}`);
    out.push('');
  }

  return out.join('\n').trimEnd();
}

/**
 * Render the skeleton as the exact Markdown the writer fills in. Every heading,
 * employer and date is already written; the writer supplies bullets only.
 */
export function skeletonBlock(skeleton) {
  if (!skeleton?.recent?.length) return '';

  const lines = [];
  lines.push('# The Work Experience section, already structured');
  lines.push('');
  lines.push('This is the exact structure of the Work Experience section, built from the record. Reproduce it verbatim and write ONLY the bullets:');
  lines.push('');
  lines.push('- Do not add, remove, rename, reorder, merge or re-date a single entry.');
  lines.push('- An engagement listed under a parent stays a sub-entry under that parent, with its own employer and dates. Never fold one into the parent\'s bullets and never promote one to a top-level role.');
  lines.push('- Choose how many bullets each entry earns by what this job needs; an entry the job has no use for may carry one bullet, but its heading still prints.');
  lines.push('- The Earlier Career list is names only. It never gains dates or bullets.');
  lines.push('');

  for (const r of skeleton.recent) {
    lines.push(`#### **${r.title}**`);
    lines.push(`**${r.company}** | ${r.dates}${r.location ? ` | ${r.location}` : ''}`);
    lines.push('- [bullets you write]');
    for (const e of r.engagements) {
      lines.push('');
      lines.push(`##### **${e.title}** · ${e.company} | ${e.dates}`);
      lines.push('- [bullets you write]');
    }
    lines.push('');
  }

  if (skeleton.earlier.length) {
    lines.push('#### **Earlier Career**');
    for (const e of skeleton.earlier) lines.push(`- ${earlierLine(e)}`);
    lines.push('');
  }

  return lines.join('\n');
}
