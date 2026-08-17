// utils/cv-validate.js
//
// LAYER 6 — output validation. Deterministic code, not a prompt: the CV rules
// in prompts/cv-rules.js tell the writer what to do, and this checks whether it
// actually did. Nothing here calls an AI, so it cannot hallucinate a violation.
//
// Two severities, exactly as the rules define them:
//   hard[]     — checks 1-4, 10, 14 and 17. A hard failure means the document
//                must not ship as is; the caller regenerates once with the
//                failures fed back.
//   warnings[] — checks 5-9 and the rest. Surfaced to the user, never blocking.
//                A warning is for something the CANDIDATE can act on (a missing
//                month, an unevidenced requirement). The app's own writing
//                defects are hard, and fixed — never reported to the user as if
//                they were theirs to solve.
//
// Every check is skipped rather than guessed when its input is missing (e.g. no
// parseable master, no blueprint section_order). A check that cannot see its
// evidence reports nothing — it never invents a failure.
//
// LANGUAGE: hard failures are English strings, and their only readers are the
// log and the generator itself on the retry. WARNINGS are read by the candidate,
// who may be working in any language, so each is a { code, params } pair the UI
// translates — never a pre-built sentence. Section names and the bullet-length
// band come from prompts/cv-sections.js, which holds them per language.

import { standardHeadings, isSlot, bulletBand } from '../prompts/cv-sections.js';
import { bannedPhrases } from '../prompts/voice.js';
import { coverWordBand } from '../prompts/market.js';
import { salutationName } from '../prompts/cover-evidence.js';
import { parseTweak } from './steering.js';
import { roles, education as educationOf, isMaster } from './master-read.js';

// ---- small parsing helpers --------------------------------------------------

// Strip markdown/HTML decoration so word counts and substring checks see prose.
function plain(text) {
  return String(text || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text) {
  const t = plain(text);
  return t ? t.split(' ') : [];
}

// Digit runs, with thousand separators normalised away so "1,200" in the CV
// matches "1200" in the master and vice versa.
function digitRuns(text) {
  return (
    String(text || '')
      .replace(/(\d)[.,\s](?=\d{3}\b)/g, '$1')
      // A digit with letters on BOTH sides is part of a word, not a claim:
      // "B2B", "Web3", "S3". Counting the 2 in "B2B SaaS" as an unsourced metric
      // hard-failed a CV over a product category and paid for a regeneration.
      .replace(/[A-Za-z]\d+[A-Za-z]/g, ' ')
      .match(/\d+/g) || []
  );
}

// The document split into its `###` sections, each with its heading and body.
export function splitSections(document) {
  const lines = String(document || '').split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m) {
      current = { heading: plain(m[1]), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections;
}

// The roles inside the Work Experience section: `#### **Title**` then a bold
// company line, then bullets.
function parseRoles(section) {
  if (!section) return [];
  const roles = [];
  let current = null;
  for (const line of section.lines) {
    const h = line.match(/^####\s+(.+?)\s*$/);
    if (h) {
      current = { title: plain(h[1]), subtitle: '', bullets: [] };
      roles.push(current);
      continue;
    }
    if (!current) continue;
    const t = line.trim();
    if (/^[-*•]\s+/.test(t)) current.bullets.push(t.replace(/^[-*•]\s+/, ''));
    else if (t && !current.subtitle && !t.startsWith('<') && !t.startsWith('---')) current.subtitle = t;
  }
  return roles;
}

// "Earlier Career" is a Layer 1 slot with a name in every supported language —
// matching it in English only would treat a Czech CV's collapsed-roles line as
// an ordinary role and fail it for being undated and unmatched.
function isEarlierCareer(heading) {
  return isSlot('earlierCareer', heading);
}

// The master as searchable text, plus a flat view of it for the checks that
// walk roles. The record nests a client engagement inside the consultancy it ran
// under, so `roles()` (utils/master-read.js) is what flattens it — a check that
// read work_experience directly would judge a CV against half the career and
// call the other half invented.
//
// `parsed.experience` carries the flat roles under the field names the checks
// use, achievements included: a bullet in the record is an achievement to a
// check asking whether a printed role has any evidence behind it.
function readMaster(master) {
  const text = typeof master === 'string' ? master : JSON.stringify(master || '');
  let raw = null;
  try {
    raw = typeof master === 'string' ? JSON.parse(master) : master;
  } catch {
    raw = null;
  }
  if (!isMaster(raw)) {
    return { text, lower: text.toLowerCase(), parsed: null };
  }
  const parsed = {
    ...raw,
    experience: roles(raw).map((r) => ({
      ...r,
      achievements: r.bullets.map((text) => ({ text, metric: '', skills_utilized: [] })),
    })),
    education: educationOf(raw),
  };
  return { text, lower: text.toLowerCase(), parsed };
}

function scenarioTags(analysis) {
  const tags = analysis?.analysis?.scenario_tags;
  return (Array.isArray(tags) ? tags : tags ? [tags] : []).map((t) => String(t).trim());
}

// ---- checks 1-4: hard blocks ------------------------------------------------

// 1. Every number in the document traces to the master. (The full "every hard
//    noun" trace is the AI verify pass in utils/openai.js, which strips rather
//    than blocks; numbers are the part code can settle on its own.)
function checkNumbersTrace(document, master, hard) {
  if (!master.text) return;
  const masterNums = new Set(digitRuns(master.text));
  const sections = splitSections(document);
  // Only prose sections — the contact line's phone digits are not claims.
  const body = sections.map((s) => s.lines.join('\n')).join('\n');
  const seen = new Set();
  for (const line of body.split('\n')) {
    // Dates get their own check; skip them here.
    const stripped = line.replace(/\b(0[1-9]|1[0-2])\/((19|20)\d{2})\b/g, ' ');
    for (const n of digitRuns(stripped)) {
      if (!masterNums.has(n) && !seen.has(n)) {
        seen.add(n);
        hard.push(`Number "${n}" appears in the CV but not in the master record.`);
      }
    }
  }
}

// 1b. Certifications trace to the master. A certification is the hard noun most
//     worth faking and the easiest for code to settle: the section is a plain
//     list, so each entry either appears in the master text or it does not.
//     (Proper nouns in free prose — an employer named only in the Summary —
//     remain the AI verify pass's job; code cannot tell a fabricated company
//     from an unusual real one.)
function checkCertificationsTrace(document, master, hard) {
  if (!master.text) return;
  for (const s of splitSections(document)) {
    if (!isSlot('certifications', s.heading)) continue;
    for (const line of s.lines) {
      const t = plain(line).trim();
      if (!/^[-*•]\s+/.test(line.trim()) || t.length < 3) continue;
      const cert = t.replace(/^[-*•]\s+/, '').trim();
      // Compare on words so punctuation and "(2019)" style suffixes don't decide it.
      const core = words(cert).filter((w) => w.length > 3).map((w) => w.toLowerCase());
      if (!core.length) continue;
      const hit = core.filter((w) => master.lower.includes(w)).length;
      if (hit / core.length < 0.6) {
        hard.push(`Certification "${cert}" appears in the CV but not in the master record.`);
      }
    }
  }
}

// The bullet entries of the Skills and Core Competencies sections, as written.
function skillEntries(document) {
  const out = [];
  for (const s of splitSections(document)) {
    if (!isSlot('skills', s.heading) && !isSlot('coreCompetencies', s.heading)) continue;
    for (const line of s.lines) {
      if (!/^[-*•]\s+/.test(line.trim())) continue;
      const skill = plain(line).replace(/^[-*•]\s+/, '').trim();
      if (skill.length >= 3) out.push(skill);
    }
  }
  return out;
}

// The content words of a skill, which are what must be found in the record —
// "&", "and", "of" carry no evidence. Matching is on a five-letter stem, not the
// whole word: the master says "Delivery Manager" where the CV says "Delivery
// Management", and Czech and Polish inflect every one of these. Exact matching
// would hard-block honest skills, which costs more than it protects.
function skillWords(skill) {
  return words(skill).filter((w) => w.length > 3).map((w) => w.toLowerCase().slice(0, 5));
}

// 14. Skills trace to the master, on exactly the basis certifications already do:
//     the section is a plain list, so each entry either appears in the record or
//     it does not. Without this, a plausible-sounding skill the candidate has
//     never had ("Value Proposition Modeling") printed unchallenged — the CV
//     making a claim about a person that the person's own record does not carry.
//     The threshold is higher than a certification's because a skill is short and
//     its words are generic: two-thirds of "Value Proposition Modeling" is present
//     in almost any product CV.
function checkSkillsTrace(document, master, hard) {
  if (!master.text) return;
  for (const skill of skillEntries(document)) {
    const core = skillWords(skill);
    if (!core.length) continue;
    const hit = core.filter((w) => master.lower.includes(w)).length;
    if (hit / core.length < 0.75) {
      hard.push(`Skill "${skill}" appears in the CV but the master record does not evidence it.`);
    }
  }
}

// 15. A listed skill whose only evidence sits in roles the CV does not show.
//     The Skills section says what the candidate is NOW: a speciality evidenced
//     only by the collapsed Earlier Career line misdirects the recruiter and
//     re-emits the age signal the recency window exists to manage.
function checkSkillRecency(document, master, warnings) {
  const experience = Array.isArray(master?.parsed?.experience) ? master.parsed.experience : [];
  if (!experience.length) return;

  // A role is "shown" when it prints as its own Work Experience entry — not when
  // its name merely appears somewhere in the prose, and not when it is dissolved
  // into the Earlier Career line's employer list.
  const printed = [];
  for (const s of splitSections(document)) {
    for (const role of parseRoles(s)) {
      if (isEarlierCareer(role.title)) continue;
      printed.push(`${role.title} ${plain(role.subtitle)}`.toLowerCase());
    }
  }
  const shown = experience.filter((role) => {
    const company = String(role?.company || role?.employer || '').trim().toLowerCase();
    const title = String(role?.role || role?.title || '').trim().toLowerCase();
    return printed.some((p) => (company.length > 2 && p.includes(company)) || (title.length > 2 && p.includes(title)));
  });
  if (!shown.length || shown.length === experience.length) return;

  const evidences = (role, core) => {
    const text = JSON.stringify(role || '').toLowerCase();
    const hit = core.filter((w) => text.includes(w)).length;
    return core.length ? hit / core.length >= 0.75 : false;
  };

  const stale = [];
  for (const skill of skillEntries(document)) {
    const core = skillWords(skill);
    if (!core.length) continue;
    const evidencedAnywhere = experience.some((r) => evidences(r, core));
    if (evidencedAnywhere && !shown.some((r) => evidences(r, core))) stale.push(skill);
  }
  if (stale.length) {
    warnings.push({ code: 'skillOutsideWindow', params: { list: stale.join(', ') } });
  }
}

// 16. A printed role whose master record holds no number anywhere. The CV cannot
//     invent one — that is T1 — so the candidate is told which role is missing
//     its metrics and can supply them.
function checkRoleMetrics(document, master, warnings) {
  if (!master?.parsed) return;
  const sections = splitSections(document);
  const exp = sections.find((s) => parseRoles(s).length > 0);
  if (!exp) return;
  const bare = [];
  for (const role of parseRoles(exp)) {
    if (isEarlierCareer(role.title)) continue;
    const entry = findMasterEntry(master, role);
    if (!entry) continue;
    const achievements = Array.isArray(entry.achievements) ? entry.achievements : [];
    if (!achievements.length) continue;
    if (!/\d/.test(JSON.stringify(achievements))) bare.push(role.title);
  }
  if (bare.length) {
    warnings.push({ code: 'noMetricsInRecord', params: { list: bare.join(', ') } });
  }
}

// 2. Dates match the master, and every dated experience entry is MM/YYYY —
//    except the year-only entries check 13 permits, collected into yearOnly[]
//    and reported to the candidate as a warning by the caller.
function checkDates(document, master, hard, yearOnly) {
  const sections = splitSections(document);
  const exp = sections.find((s) => parseRoles(s).length > 0);
  if (!exp) return;
  const text = exp.lines.join('\n');

  // Format: any year in the experience section must be part of an MM/YYYY pair,
  // with ONE exception (check 13) — a year the master itself records without a
  // month. Inventing "01/" to complete the pattern would falsify a date, so the
  // bare year is correct there and only warns. A bare year the master DOES hold
  // a month for is the old failure: year-only dates softening a gap.
  const mmYyyy = text.match(/\b(0[1-9]|1[0-2])\/((19|20)\d{2})\b/g) || [];
  const bare = (text.replace(/\b(0[1-9]|1[0-2])\/((19|20)\d{2})\b/g, ' ').match(/\b(19|20)\d{2}\b/g) || []);
  for (const year of new Set(bare)) {
    const masterHasMonth = new RegExp(`\\b(0[1-9]|1[0-2])[\\/.\\-]${year}\\b`).test(master.text || '');
    if (masterHasMonth) {
      hard.push(`Work Experience shows the year ${year} without a month, but the master records a month for it — MM/YYYY is required wherever the master supplies it.`);
    } else {
      yearOnly.push(year);
    }
  }

  if (!master.text) return;
  const masterYears = new Set(master.text.match(/\b(19|20)\d{2}\b/g) || []);
  if (!masterYears.size) return;
  for (const d of new Set(mmYyyy)) {
    const year = d.split('/')[1];
    if (!masterYears.has(year)) hard.push(`Date "${d}" does not appear in the master record.`);
  }
}

// 3. No Work Experience entry that was not a real role.
function checkRolesReal(document, master, hard) {
  if (!master.lower) return;
  // plain() strips "|" out of a printed heading, so a real multi-part title
  // ("Product Strategy & UX Leader | Custom AI Solutions | Coach") no longer
  // matches the master's copy of itself and the role reads as invented. Compare
  // both sides with the separators removed.
  const masterFlat = master.lower.replace(/[|]/g, ' ').replace(/\s+/g, ' ');
  const sections = splitSections(document);
  for (const s of sections) {
    for (const role of parseRoles(s)) {
      if (isEarlierCareer(role.title)) continue;
      const title = role.title.toLowerCase();
      if (title && !masterFlat.includes(title.replace(/\s+/g, ' '))) {
        // The employer is the harder signal — a title may legitimately be
        // relabelled in wording only if the master states it, so check both and
        // fail only when neither is found.
        const company = plain(role.subtitle).split('|')[0].trim().toLowerCase();
        if (!company || !masterFlat.includes(company)) {
          hard.push(`Work Experience entry "${role.title}" matches no role in the master record.`);
        }
      }
    }
  }
}

// 4. Single column, standard headers, no layout HTML.
function checkStructure(document, analysis, hard) {
  const doc = String(document || '');
  const banned = doc.match(/<\s*(table|tr|td|th|div|ul|ol|li|img|figure)\b/gi);
  if (banned) {
    hard.push(`CV contains layout HTML (${[...new Set(banned.map((b) => b.replace(/[<\s]/g, '')))].join(', ')}) — single column, no tables or columns.`);
  }

  // Heading depth: the document uses exactly two heading levels — ### for a
  // section and #### for a role. Anything else is a sub-heading invented inside
  // a role (client engagements, project groupings). The DOCX exporter does not
  // parse those, so they print literally as "## Client Engagement: ..." in the
  // delivered file, and they break the single flat structure an ATS expects.
  // The name block above the first section legitimately uses "# Name"; the rule
  // applies from the first ### section onwards, which is where roles live.
  let inSections = false;
  for (const line of doc.split('\n')) {
    const h = line.match(/^\s*(#{1,6})\s+\S/);
    if (!h) continue;
    if (h[1].length === 3) inSections = true;
    if (inSections && h[1].length !== 3 && h[1].length !== 4) {
      hard.push(`Heading "${line.trim().slice(0, 60)}" uses ${h[1].length} hash marks — only ### (section) and #### (role) are allowed. Client engagements and projects are bullets, not sub-headings.`);
    }
  }

  // Section names: a heading passes if it is one of the standard names in ANY
  // supported language, or if the blueprint's own section_order names it. Both
  // are needed. The document's language is not reliably known here — 'auto'
  // resolves inside the model — and the blueprint is written in the CV's
  // language while the document may be generated in another, so neither source
  // alone can judge a Czech CV built from an English record. A creative heading
  // still fails, because it is in neither.
  const allowed = analysis?.generation_framework?.cv_blueprint?.section_order;
  const blueprintNames = Array.isArray(allowed) ? allowed.map((a) => plain(a).toLowerCase()) : [];
  const permitted = new Set([...standardHeadings(), ...blueprintNames]);
  for (const s of splitSections(doc)) {
    if (!permitted.has(s.heading.toLowerCase())) {
      hard.push(`Section "${s.heading}" is not a standard section name in any supported language, and the blueprint does not name it.`);
    }
  }
}

// ---- checks 5-9: warnings ---------------------------------------------------

// 5. Impact zone: headline + proposition + the evidenced achievements (up to
//    three), each naming its role, all inside ~120 words.
//
//    The achievement bullets are REQUIRED, and their duplication further down the
//    document is deliberate — a recruiter who reads only the top block still sees
//    the three strongest results. The ceiling is three but the floor is what the
//    master evidences, so a thin record legitimately shows fewer; only an empty
//    Summary block is reported.
function checkImpactZone(document, master, warnings) {
  const sections = splitSections(document);
  const summary = sections[0];
  if (!summary) {
    warnings.push({ code: 'noSections' });
    return;
  }
  const bullets = summary.lines.filter((l) => /^\s*[-*•]\s+/.test(l)).map((l) => l.replace(/^\s*[-*•]\s+/, ''));
  if (bullets.length === 0) {
    warnings.push({ code: 'summaryNoAchievements' });
  } else if (bullets.length > 3) {
    warnings.push({ code: 'summaryTooManyAchievements', params: { count: bullets.length } });
  }

  // Each bullet must name the role or employer it came from. The master's own
  // titles and companies are the only accepted evidence of that, so a record we
  // cannot parse reports nothing rather than guessing.
  const sources = masterRoleNames(master);
  if (sources.length) {
    const unattributed = bullets.filter((b) => {
      const low = plain(b).toLowerCase();
      return !sources.some((s) => low.includes(s));
    });
    if (unattributed.length) {
      warnings.push({ code: 'summaryAchievementNoRole', params: { count: unattributed.length } });
    }
  }

  // The duplication is deliberate; copying the SENTENCE is not. The top block is
  // the compressed, re-angled version, so a Summary bullet that repeats a role
  // bullet word for word makes the recruiter read the same line twice and spends
  // the impact zone on words already spent.
  const roleBullets = [];
  for (const s of sections) {
    for (const role of parseRoles(s)) roleBullets.push(...role.bullets);
  }
  const copied = bullets.filter((b) => roleBullets.some((rb) => nearVerbatim(b, rb)));
  if (copied.length) {
    warnings.push({ code: 'summaryVerbatimCopy', params: { count: copied.length } });
  }

  // Counted from the VERY TOP of the document, not from the Summary heading: the
  // name/contact block and the headline sit above it and are read first, so they
  // spend the recruiter's 120 words exactly as the Summary does.
  const doc = String(document || '');
  const head = doc.split(/^###\s+/m)[0] || '';
  const count = words(head).length + words(summary.lines.join(' ')).length;
  if (count > 120) warnings.push({ code: 'impactZoneWords', params: { count } });
}

// Is one bullet a word-for-word restatement of the other? The Summary version
// legitimately drops the role prefix ("As Head of Delivery at Acme Ltd, ") and
// may stop short of the role bullet's tail, so the test is whether what remains
// runs as an unbroken word sequence inside the other — not whether the two
// strings match. A genuinely re-angled bullet reorders and rewords, and breaks
// the run immediately.
const MIN_RUN = 8;

function bulletWords(text) {
  return plain(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

export function nearVerbatim(a, b) {
  const x = bulletWords(a);
  const y = bulletWords(b);
  if (x.length < MIN_RUN || y.length < MIN_RUN) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const hay = ` ${long.join(' ')} `;
  // The longest suffix of the shorter bullet that appears verbatim in the other:
  // walk the start forward, since the role prefix is what differs.
  for (let i = 0; i + MIN_RUN <= short.length; i++) {
    const run = short.slice(i);
    if (hay.includes(` ${run.join(' ')} `)) return true;
  }
  return false;
}

// Every role title and company the master records, lowercased — used to check
// that a Summary achievement names where it came from.
function masterRoleNames(master) {
  const experience = Array.isArray(master?.parsed?.experience) ? master.parsed.experience : [];
  const names = [];
  for (const role of experience) {
    for (const key of ['title', 'role', 'company', 'employer']) {
      const v = role?.[key];
      if (typeof v === 'string' && v.trim().length > 2) names.push(v.trim().toLowerCase());
    }
  }
  return names;
}

// 6. Bullet ceilings, and the metric-fallback share where metrics exist.
function checkBullets(document, master, language, warnings) {
  const [minWords, maxWords] = bulletBand(language);
  const sections = splitSections(document);
  const exp = sections.find((s) => parseRoles(s).length > 0);
  if (!exp) return;
  const roles = parseRoles(exp);
  roles.forEach((role, i) => {
    if (isEarlierCareer(role.title)) return;
    const ceiling = i < 2 ? 5 : 3;
    if (role.bullets.length > ceiling) {
      warnings.push({ code: 'bulletCeiling', params: { role: role.title, count: role.bullets.length, ceiling } });
    }
    for (const b of role.bullets) {
      const n = words(b).length;
      if (n < minWords || n > maxWords) {
        warnings.push({ code: 'bulletBand', params: { role: role.title, count: n, min: minWords, max: maxWords } });
      }
    }
    // Fallback share: only meaningful when the master actually holds metrics
    // for this role, which needs the master in parsed form.
    const entry = findMasterEntry(master, role);
    if (!entry || !role.bullets.length) return;
    // Only the achievements count as metrics — the entry's own dates are digits
    // too, and every entry has those.
    const achievements = Array.isArray(entry.achievements) ? entry.achievements : [];
    if (!/\d/.test(JSON.stringify(achievements))) return; // no metrics exist — fallbacks are unlimited
    const noMetric = role.bullets.filter((b) => !/\d/.test(b)).length;
    if (noMetric > role.bullets.length / 3) {
      warnings.push({ code: 'metricFallback', params: { role: role.title, count: noMetric, total: role.bullets.length } });
    }
  });
}

function findMasterEntry(master, role) {
  const experience = master?.parsed?.experience;
  if (!Array.isArray(experience)) return null;
  const company = plain(role.subtitle).split('|')[0].trim().toLowerCase();
  const title = role.title.toLowerCase();
  return experience.find((e) => {
    const c = String(e?.company || '').toLowerCase();
    const t = String(e?.role || e?.title || '').toLowerCase();
    return (company && c && c === company) || (title && t && t === title);
  }) || null;
}

// 7. Market rules: nothing personal was invented.
function checkMarket(document, master, warnings) {
  const doc = String(document || '');
  if (/!\[[^\]]*\]\(/.test(doc)) warnings.push({ code: 'photoInvented' });
  const invented = [
    [/\b(date of birth|datum narození|data urodzenia|born on|d\.o\.b\.)\b/i, 'dobInvented'],
    [/\b(consent to the processing|zpracování osobních údajů|przetwarzanie danych osobowych|GDPR consent)\b/i, 'consentInvented'],
  ];
  for (const [re, code] of invented) {
    if (re.test(doc) && !(master.lower && re.test(master.text))) {
      warnings.push({ code });
    }
  }
}

// 8. With a job ad: unevidenced requirements are reported to the user as gaps.
function checkGaps(analysis, warnings) {
  const missing = analysis?.analysis?.ats_keywords_missing;
  const list = Array.isArray(missing)
    ? missing
    : typeof missing === 'string' && missing.trim() && missing.trim() !== 'n/a'
      ? [missing.trim()]
      : [];
  if (list.length) {
    warnings.push({ code: 'gaps', params: { list: list.join('; ') } });
  }
}

// 9. A Projects section requires a qualifying override.
function checkProjects(document, analysis, warnings) {
  const sections = splitSections(document);
  const hasProjects = sections.some((s) => isSlot('projects', s.heading));
  if (!hasProjects) return;
  const tags = scenarioTags(analysis);
  if (!tags.includes('Under-qualified') && !tags.includes('Career Pivot')) {
    warnings.push({ code: 'projectsNoOverride' });
  }
}

// 10. Older Applicant, HARD: the override's two arithmetic promises. A stray
//     graduation year or a career total undoes the whole mitigation, and code can
//     settle both beyond doubt — so this blocks rather than warns.
const OLDER_APPLICANT_TAG = 'older applicant';

function checkOlderApplicant(document, analysis, hard) {
  const active = scenarioTags(analysis).some((t) => t.toLowerCase() === OLDER_APPLICANT_TAG);
  if (!active) return;

  const sections = splitSections(document);
  for (const s of sections) {
    if (!isSlot('education', s.heading)) continue;
    for (const line of s.lines) {
      const year = plain(line).match(/\b(19|20)\d{2}\b/);
      if (year) {
        hard.push(`Education entry "${plain(line).trim()}" still carries the year ${year[0]}; the Older Applicant override strips graduation years from EVERY Education entry.`);
      }
    }
  }

  // The banned thing is the CUMULATIVE total — one figure the screening sort can
  // act on before it reads anything. A duration scoped to a single role or
  // engagement ("five years running the Prague platform team") is evidence of
  // depth, not an age signal, and the earlier catch-all regex hard-blocked it.
  const doc = plain(String(document || ''));
  const totals = [
    /\b\d+\s*\+\s*(years|let|lat)\b/i,                                   // "25+ years"
    /\b\d+\s*(years|let|lat)\b[^.]{0,20}\b(experience|expertise|career|zkušeností|doświadczenia)\b/i,
    /\b(a|over a|nearly a)\s+decade\s+of\b/i,
    /\b(two|three|four|several|multiple|over)\s+decades\b/i,
  ];
  for (const re of totals) {
    const hit = doc.match(re);
    if (hit) {
      hard.push(`The CV states a cumulative career total ("${hit[0].trim()}"); the Older Applicant override forbids career totals. A duration scoped to one role is fine — a sum of the whole career is not.`);
      break;
    }
  }
}

// 11. The Earlier Career section names at least one real employer from the
//     master, prints at most six bullets, carries no dates, and states no
//     location the master does not record.
//     A category ("financial institutions and tech companies") dissolves the
//     marquee name that is the only reason the section is worth printing. The
//     cap keeps it from dragging the reader back through a career the recency
//     window exists to close, the dates are what carry the age signal, and an
//     inferred location — the employer's well-known home city, which the master
//     never recorded — is a fabricated fact under T1.
const EARLIER_CAREER_MAX_BULLETS = 6;

function checkEarlierCareer(document, master, warnings) {
  if (!master.parsed) return;
  const companies = [];
  const locations = [];
  for (const role of Array.isArray(master.parsed.experience) ? master.parsed.experience : []) {
    for (const key of ['company', 'employer']) {
      const v = role?.[key];
      if (typeof v === 'string' && v.trim().length > 2) companies.push(v.trim().toLowerCase());
    }
    const loc = role?.location;
    if (typeof loc === 'string' && loc.trim()) locations.push(loc.trim().toLowerCase());
  }
  if (!companies.length) return;

  for (const s of splitSections(document)) {
    for (const role of parseRoles(s)) {
      if (!isEarlierCareer(role.title)) continue;
      const text = `${plain(role.subtitle)} ${role.bullets.join(' ')}`.toLowerCase();
      if (!companies.some((c) => text.includes(c))) {
        warnings.push({ code: 'earlierCareerNoEmployer' });
      }

      if (role.bullets.length > EARLIER_CAREER_MAX_BULLETS) {
        warnings.push({
          code: 'earlierCareerTooManyBullets',
          params: { count: role.bullets.length, max: EARLIER_CAREER_MAX_BULLETS },
        });
      }

      // The section is the one permitted undated entry, so any year at all is
      // the age signal walking back in through it.
      const dated = role.bullets.filter((b) => /\b(19|20)\d{2}\b/.test(plain(b)));
      if (dated.length) {
        warnings.push({ code: 'earlierCareerDated', params: { count: dated.length } });
      }

      // Each bullet is "Title, Employer — Location"; the tail after the dash is
      // the only place a location may appear, so it is the only place to check.
      for (const bullet of role.bullets) {
        const tail = plain(bullet).split(/\s+[—–]\s+/)[1];
        if (!tail || !tail.trim()) continue;
        const claimed = tail.trim().toLowerCase().replace(/[.;,]+$/, '');
        const recorded = locations.some(
          (l) => l.includes(claimed) || claimed.includes(l),
        );
        if (!recorded) {
          warnings.push({ code: 'earlierCareerLocation', params: { location: tail.trim() } });
        }
      }
    }
  }
}

// 12. No identity epithet in the headline or Summary — a category asserted in
//     place of evidence, and an age signal in the one place it hurts most.
const EPITHETS = [
  'veteran', 'seasoned', 'accomplished', 'industry expert', 'technology leader',
  'thought leader', 'world-class', 'renowned', 'distinguished',
];

function checkEpithets(document, warnings) {
  const sections = splitSections(document);
  // The headline sits above the first `###`, so it is not in any section.
  const head = plain(String(document || '').split(/^###\s+/m)[0] || '');
  const summary = sections[0] ? plain(sections[0].lines.join(' ')) : '';
  const text = `${head} ${summary}`.toLowerCase();
  const found = EPITHETS.filter((e) => new RegExp(`\\b${e}\\b`, 'i').test(text));
  if (found.length) {
    warnings.push({ code: 'identityEpithet', params: { list: found.join(', ') } });
  }
}


// 17. No banned stock phrase anywhere in the document (CV_RULES.md, Layer 2).
//     The prompt already forbids the list; this is what makes the ban real —
//     five of these undo a page of real evidence, and a rule only asked for is
//     followed most of the time. The list is imported from prompts/voice.js so
//     the instruction and the check cannot drift apart.
//
//     Matched on the plain text (markup stripped) so "**seamless**" cannot hide,
//     literal and case-insensitive, with word boundaries where the phrase starts
//     and ends on a word character — "synergy" must not fire inside a longer
//     word, and "underscore" must not fire on "underscored the beam" in some
//     unrelated trade. Every hit is reported, so the candidate sees the actual
//     phrases rather than a count.
function phraseHits(document, language) {
  const text = plain(document).toLowerCase();
  const hits = [];
  for (const phrase of bannedPhrases(language)) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lead = /^\w/.test(phrase) ? '\\b' : '';
    const tail = /\w$/.test(phrase) ? '\\b' : '';
    if (new RegExp(`${lead}${escaped}${tail}`, 'i').test(text)) hits.push(phrase);
  }
  return hits;
}

//     Neither hard nor a warning. A stock phrase is the app's own writing
//     failing, so the user never sees it — but regenerating a whole document to
//     remove one clause reprints a page of good work and re-opens every
//     judgement the draft already got right. The caller runs a targeted repair
//     over these exact spans instead, which is why this is exported as a plain
//     finder rather than wired into validateCv's hard/warning lists.
export function bannedPhraseHits(document, language = 'auto') {
  return phraseHits(document, language);
}

// ---- the validator ----------------------------------------------------------

export function validateCv(document, { master = '', analysis = null, language = 'auto' } = {}) {
  const hard = [];
  const warnings = [];
  const m = readMaster(master);

  const yearOnly = [];

  checkNumbersTrace(document, m, hard);
  checkCertificationsTrace(document, m, hard);
  checkSkillsTrace(document, m, hard);
  checkDates(document, m, hard, yearOnly);
  checkRolesReal(document, m, hard);
  checkStructure(document, analysis, hard);
  checkOlderApplicant(document, analysis, hard);
  checkAdTerms(document, m, analysis, hard);

  checkImpactZone(document, m, warnings);
  checkBullets(document, m, language, warnings);
  checkMarket(document, m, warnings);
  checkGaps(analysis, warnings);
  checkProjects(document, analysis, warnings);
  checkEarlierCareer(document, m, warnings);
  checkEpithets(document, warnings);
  checkSkillRecency(document, m, warnings);
  checkRoleMetrics(document, m, warnings);

  // 13. Year-only dates the master could not supply a month for. Printing the
  //     bare year is correct — inventing "01/" would falsify the record — so the
  //     candidate is told which months are missing and can fill them in.
  if (yearOnly.length) {
    warnings.push({ code: 'missingMonth', params: { list: [...new Set(yearOnly)].sort().join(', ') } });
  }

  return { ok: hard.length === 0, hard, warnings };
}

// The correction note fed back to the generator on a hard failure — the same
// rules, pointed at what the document actually got wrong.
export function validationFeedback(hard, docType = 'cv') {
  const doc = docType === 'cover' ? 'cover letter' : 'CV';
  const remedy = docType === 'cover'
    ? `Fix them WITHOUT inventing anything and WITHOUT dropping the argument: cut the weakest supporting sentences and the words that carry no claim, keep the matched pairs and the evidence that proves them, and keep the salutation and signature block exactly as they are.`
    : `Fix them WITHOUT inventing anything: correct a wrong number by using the master's number or cutting the claim, correct a date by copying the master's date, remove any entry that is not a real role, and express any structure with plain single-column markdown.`;
  return `# Output validation FAILED — fix these before returning the ${doc}
Your previous draft broke rules that cannot be broken. Regenerate the ${doc}, keeping everything that was right and fixing exactly these:
${hard.map((h) => `- ${h}`).join('\n')}

${remedy}`;
}

// The cover letter's slice of Layer 6. The letter has no sections, dates or
// bullets to check, so almost nothing in validateCv applies to it — but the
// banned-phrase list does, and the letter is prose, which is exactly where the
// boilerplate wrapper ("I am writing to express my interest") lands. Same list,
// same { code, params } warnings, so the UI renders both documents' findings
// through the one translation path.
// The letter's BODY: what the word band is measured against, and the only part
// checks 19-22 read. The date line, the salutation and the signature block are
// scaffolding, not argument, so they are stripped exactly as coverLengthRule
// promises the writer they will be.
export function coverBody(document) {
  let lines = String(document || '').split('\n');
  const sigIndex = lines.findIndex((l) => /^\s*(sincerely|kind regards|best regards|yours sincerely|s pozdravem|z poważaniem)\b/i.test(l));
  if (sigIndex !== -1) lines = lines.slice(0, sigIndex);
  lines = lines.filter((l) => !/^\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*$/.test(l));
  const salIndex = lines.findIndex((l) => /^\s*(dear|vážen|szanown)/i.test(l));
  if (salIndex !== -1) lines = lines.slice(salIndex + 1);
  return lines.join('\n').trim();
}

// Content words worth matching on: long enough to be distinctive, so a pair is
// not "found" because the letter and the requirement both say "the".
function distinctiveTokens(text) {
  return [...new Set(
    plain(text).toLowerCase().replace(/[^a-z0-9á-žäöüß\s]/gi, ' ').split(/\s+/)
      .filter((w) => w.length > 4)
  )];
}

// Half a pair counts as reaching the page when TWO of its distinctive words did
// — one shared word ("product") is vocabulary two unrelated sentences happen to
// share, and counting it marks a pair present that the letter never made. A half
// that only has one distinctive word to give is matched on that one.
function halfPresent(haystack, tokens) {
  if (!tokens.length) return false;
  const hits = tokens.filter((t) => haystack.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

// 19. With a job ad, each requirement the record CAN answer is answered. Code
//     cannot judge whether an answer persuades, but it can see whether one
//     reached the page at all.
//
//     ONLY THE EVIDENCE HALF IS MATCHED, never the requirement. This is an EU
//     product and the two halves are routinely in different languages: the
//     requirement is quoted verbatim from the ad ("facilitujeme pětidenní design
//     sprinty") while the letter is written in the candidate's own ("I am a
//     Certified Google Design Sprint Master"). Requiring words from both halves
//     found nothing on EVERY cross-language application — a real Czech ad
//     answered by a real English letter reported "answers none of the 5
//     requirements" while the letter answered two of them. Only the evidence,
//     drawn from the record in the record's own language, can be looked for.
//
//     The evidence pool is not a plan and its size is not a target: the writer
//     chooses which requirements the letter argues, and one left out because the
//     argument had no room is a judgement, not a defect. What IS worth telling
//     the candidate is that NONE of it reached the page. Steering does not
//     suspend it: a candidate who demoted the evidence behind every requirement
//     has an unanswered ad and is entitled to know.
//
//     Where the letter shares no language with the record, nothing can be
//     matched and the check reports nothing rather than a verdict it cannot
//     support. A letter naming one of the master's employers is the cheap proof
//     that the two share a vocabulary at all.
function lettersShareLanguage(body, master) {
  const employers = masterEmployers(master);
  if (!employers.length) return false;
  const text = plain(body).toLowerCase();
  return employers.some((e) => namesEmployer(text, e));
}

//     CONTRACT CLAUSE C1 (check 27): this is no longer a warning. A letter that
//     answers NONE of the requirements the record can answer has not done the one
//     thing a cover letter exists to do, so it is a hard failure that regenerates
//     with the failure named — the mechanism the word band already uses. The
//     silences are unchanged: no pool, no usable evidence, or no shared language
//     still reports nothing, because none of those is the letter's fault.
function checkCoverRequirements(body, analysis, hard, master) {
  const pool = analysis?.generation_framework?.cover_evidence?.requirement_evidence;
  if (!Array.isArray(pool) || pool.length === 0) return;
  const text = plain(body).toLowerCase();
  const usable = pool
    .map((p) => distinctiveTokens(p?.evidence))
    .filter((tokens) => tokens.length);
  if (!usable.length) return;
  const answered = usable.filter((tokens) => halfPresent(text, tokens)).length;
  if (answered > 0) return;
  // Nothing matched. Before reporting, make sure that means something.
  if (!lettersShareLanguage(body, master)) return;
  hard.push(`The letter answers none of the ${usable.length} requirements this record can genuinely answer. Take the strongest ONE or TWO of the evidence items you were given and prove them in the prose — what the situation was, what the candidate did, what changed. Invent nothing: use the evidence as recorded.`);
}

// ---- The contract checks (CV_RULES.md checks 26-30) -------------------------
//
// Five deterministic checks over the finished letter, one per thing the contract
// requires. Each is computed from the analysis, the master and the letter — no
// AI call and no judgement of quality, only whether the required thing is on the
// page. Each failure is hard and regenerates the letter once with that failure
// named, exactly as the word band does.

// The letter's first paragraph — the position the steering checks govern, since
// it is the one place that either carries an emphasis or contradicts a demotion.
function firstParagraph(body) {
  return String(body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)[0] || '';
}

// 26. Language (C4). Judged on FUNCTION WORDS, not content: a letter quoting an
//     English job title inside Czech prose is Czech, and one distinctive noun
//     decides nothing. Czech is additionally evidenced by its own diacritics.
//     Only 'en' and 'cs' can be requested today (prompts/language.js), and the
//     check stays silent on 'auto' — there is no stated target to measure.
const LANG_MARKERS = {
  en: ['the', 'and', 'with', 'that', 'for', 'have', 'this', 'from', 'which', 'their', 'been', 'would'],
  cs: ['a', 'se', 'na', 'v', 'je', 'pro', 'které', 'jsem', 'že', 've', 'k', 'jako', 'byl'],
};

function markerScore(text, markers) {
  const tokens = plain(text).toLowerCase().split(/[^a-zá-ž]+/i).filter(Boolean);
  if (!tokens.length) return 0;
  const hits = tokens.filter((t) => markers.includes(t)).length;
  return hits / tokens.length;
}

function checkCoverLanguage(body, language, hard) {
  const want = LANG_MARKERS[language];
  if (!want) return;
  const text = plain(body);
  // Too little prose to judge: a two-sentence body gives no reliable ratio.
  if (words(text).length < 40) return;
  const wanted = markerScore(text, want);
  const others = Object.entries(LANG_MARKERS)
    .filter(([code]) => code !== language)
    .map(([code, markers]) => ({ code, score: markerScore(text, markers) }));
  const diacritics = /[ěščřžýáíéůúťďňó]/i.test(text);
  const best = others.sort((a, b) => b.score - a.score)[0];
  // Czech carries a second, independent signal: its diacritics. An English
  // letter is not merely low on Czech function words, it has no háčky either.
  const wantedOk = language === 'cs' ? wanted > 0 && diacritics : wanted > 0;
  if (wantedOk && (!best || wanted >= best.score)) return;
  hard.push(`The letter is not written in the requested language (${language}). Rewrite the ENTIRE body in ${language === 'cs' ? 'Czech' : 'English'} — proper nouns stay as they are.`);
}

// 28. A red flag is addressed when one exists (C2). The computable case is the
//     concern the analysis paired with an answering fact from the record: the
//     letter must carry that fact. Where no concern carries an answer, code has
//     no evidence to look for and reports nothing — demanding a clause anyway
//     would force the letter to invent one, which the invariants forbid.
function checkCoverRedFlag(body, analysis, hard) {
  const concerns = analysis?.generation_framework?.cover_evidence?.concerns;
  if (!Array.isArray(concerns) || !concerns.length) return;
  const usable = concerns
    .map((c) => distinctiveTokens(c?.answer_evidence))
    .filter((tokens) => tokens.length);
  if (!usable.length) return;
  const text = plain(body).toLowerCase();
  if (usable.some((tokens) => halfPresent(text, tokens))) return;
  hard.push(`The letter addresses none of the ${usable.length} recruiter concerns this record can answer. Take ONE of them and settle it in a single flat clause inside the body — never in the opening, never in the close — carrying the fact from the record that makes it a non-issue. Do not restate the doubt itself.`);
}

// 29/30. Steering (C4). Emphasised content leads: it is in the first paragraph.
//        Demoted content is absent from it — later, plain, single mention stays
//        permitted by the invariants, so only the opening is governed.
//
//        Matched on the steering text's own distinctive words, extended with the
//        master employer names that text refers to, because a candidate writes
//        "the Salsita work" where the letter writes "Salsita Software".
function steeringTokens(text, master) {
  const own = distinctiveTokens(text);
  if (!own.length) return [];
  const lower = plain(text).toLowerCase();
  const named = masterEmployers(master).filter((e) => namesEmployer(lower, e));
  return [...new Set([...own, ...named.flatMap((e) => distinctiveTokens(e))])];
}

function checkCoverSteering(body, tweak, master, hard) {
  const { emphasise, playDown } = parseTweak(tweak);
  const opening = plain(firstParagraph(body)).toLowerCase();
  if (!opening) return;

  if (emphasise) {
    const tokens = steeringTokens(emphasise, master);
    if (tokens.length && !halfPresent(opening, tokens)) {
      hard.push(`The candidate asked you to lead with: "${emphasise}". The first paragraph does not carry it. Open on that, proved with the facts the record holds for it — an emphasis reduced to a passing clause later on has been ignored, not applied.`);
    }
  }

  if (playDown) {
    const tokens = steeringTokens(playDown, master);
    if (tokens.length && halfPresent(opening, tokens)) {
      hard.push(`The candidate asked you to play down: "${playDown}". It is in the first paragraph, which is the one position that contradicts that outright. Open on other real evidence instead; the demoted content may still appear once, later and plainly, but it is not what this letter leads on.`);
    }
  }
}

// 31. THE LETTER NAMES THE EMPLOYER IT IS WRITTEN TO.
//
//     A real run produced a competent, entirely generic letter for an EdTech
//     company called KUBO that never once said "KUBO". Every other check passed
//     it: the evidence was real, the argument held, the voice was there. What
//     was missing is the one thing that makes a letter an application rather
//     than a self-description, and it is trivially checkable.
//
//     Hard, because the fix is a word and the defect is fatal to the document.
//     Silent where the record names no employer (a standalone review, or an
//     extraction that lost it) — the check never demands a name that does not
//     exist. Matched on the diacritic-folded stem, so Czech inflection ("v
//     KUBO", "do Seznamu") still counts as naming them.
function checkCoverNamesEmployer(body, analysis, hard) {
  const raw = String(
    analysis?.job_extraction?.company || analysis?.job_data?.Company || ''
  ).trim();
  if (!raw) return;
  // A legal-form suffix is not the name: "Seznam.cz a.s." is named by "Seznam".
  const core = raw.replace(/\b(a\.?\s?s\.?|s\.?\s?r\.?\s?o\.?|z\.?\s?ú\.?|sp\.? z o\.?o\.?|ltd\.?|inc\.?|gmbh|b\.?v\.?)\b/gi, '').trim();
  // The FIRST word of the name, which is the distinctive one: "PLG Group" is
  // named by "PLG", "Seznam.cz a.s." by "Seznam". stem() folds a whole string
  // into one token, so a multi-word name run through it ("plggro") could never
  // match anything the letter actually wrote.
  const root = stem((core || raw).split(/\s+/)[0]);
  if (!root) return;
  const said = plain(body).split(/\s+/).map(stem).filter(Boolean);
  if (said.some((w) => w.startsWith(root.slice(0, Math.min(4, root.length))))) return;
  hard.push(`The letter never names the employer it is addressed to (${raw}). Name them in the prose, early and naturally — a letter that names nobody reads as written for nobody. Do not add a header line and do not open with "I am writing to apply for the position of…".`);
}

// 20. The salutation addresses the contact the job data names. A named contact
//     left as "Dear Hiring Manager" is the cheapest tell in the letter.
function checkCoverSalutation(document, analysis, warnings) {
  const name = salutationName(analysis);
  if (!name) return;
  const line = String(document || '').split('\n').find((l) => /^\s*(dear|vážen|szanown)/i.test(l));
  if (!line) return;
  // A CZECH OR POLISH SALUTATION DECLINES THE NAME.
  //
  // "Vážený pane Nováku," is Novák in the vocative, and it is the CORRECT form —
  // a substring match on "novák" misses it and the check would then warn that
  // the letter ignored a contact it addressed properly. So the name and the
  // words in the salutation are compared on their diacritic-folded STEMS, which
  // is what an inflected pair shares: novak/novaku, petr/petre, jan/jane.
  // EITHER part of the name counts. English addresses the given name ("Dear
  // Deborah"), Czech and Polish address the SURNAME with the honorific ("Vážený
  // pane Nováku,", "Szanowny Panie Kowalski,") — a check that only looked at the
  // first word reported every correctly addressed Czech letter as generic.
  const roots = name.split(/\s+/)
    .map(stem)
    .filter(Boolean)
    .map((p) => p.slice(0, Math.min(4, p.length)));
  if (!roots.length) return;
  const said = plain(line).split(/\s+/).map(stem).filter(Boolean);
  if (!said.some((w) => roots.some((r) => w.startsWith(r)))) {
    warnings.push({ code: 'coverSalutation', params: { name } });
  }
}

// 21. At most one red-flag clause. The analysis picks the single objection the
//     letter may defuse; a second one is the letter arguing with a reader who
//     has not spoken. A sentence counts as answering a flag only when it carries
//     TWO distinctive words from that flag — one is a coincidence of vocabulary.
function checkCoverObjections(body, analysis, warnings) {
  const flags = analysis?.analysis?.red_flags;
  if (!Array.isArray(flags) || !flags.length) return;
  const sentences = body.split(/(?<=[.!?])\s+/).map((s) => plain(s).toLowerCase()).filter(Boolean);
  const touched = sentences.filter((s) =>
    flags.some((f) => distinctiveTokens(typeof f === 'string' ? f : f?.flag).filter((t) => s.includes(t)).length >= 2)
  ).length;
  if (touched > 1) {
    warnings.push({ code: 'coverManyObjections', params: { count: touched } });
  }
}

// 22. No claim the record does not support. The part code can settle is the same
//     part it settles on the CV: every number in the letter traces to the master.
function checkCoverNumbers(body, master, warnings) {
  if (!master.text) return;
  const masterNums = new Set(digitRuns(master.text));
  const stray = [...new Set(digitRuns(body))].filter((n) => !masterNums.has(n));
  if (stray.length) {
    warnings.push({ code: 'coverNumber', params: { list: stray.join(', ') } });
  }
}

// ---- 23. vocabulary provenance ---------------------------------------------
//
// The letter may only name a DOMAIN the job ad or the master gave it. The case
// this exists for is real: a Product Owner ad asking for banking, insurance or
// independent financial advisory came back as a letter about the candidate's
// "fintech" background — a word in neither the ad nor the record, supplied by
// the model because three finance nouns suggested a label. Every AI pass let it
// through: it carries no number, no date and no upgraded verb, so none of the
// five verify categories is looking at it.
//
// The check is a CLOSED LIST, on the same reasoning as the banned-phrasing list
// in Layer 2. The open version — report any word absent from both sources —
// flags ordinary prose instead: a Czech verb the ad happens not to use is not an
// invention, and a warning that fires on "pracoval" teaches the candidate to
// ignore the banner. A closed list of industry labels reports the defect and
// nothing else, and it grows only by adding a term actually seen invented.
//
// Matching folds diacritics and truncates to a stem, because Czech and Polish
// inflect the suffix: "fintech", "fintechu" and "fintechem" are one word to a
// reader and three strings to a computer.
const STEM_LEN = 6;

// One word reduced to what its inflected forms share: no diacritics, no case,
// no punctuation, cut to its stem.
function stem(word) {
  const folded = String(word || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return folded.length < 4 ? '' : folded.slice(0, STEM_LEN);
}

function stemSet(text) {
  const out = new Set();
  for (const w of plain(text).split(/\s+/)) {
    const s = stem(w);
    if (s) out.add(s);
  }
  return out;
}

// THE PROOF QUOTE IS CHECKED AGAINST THE RECORD.
//
// `analysis.ats_keywords_present` is written under a prompt telling the model to
// be GENEROUS, and every term it lists is safe to put on the CV — it feeds
// `skills_to_highlight`, and being "present" keeps it out of
// `ats_keywords_missing`, which is the deny-list checks 24/26 read. So a term
// the model merely BELIEVES is earned is the one leak nothing downstream can
// see: on the KUBO run (2026-08-16) "B2B", "Account Management" and
// "onboarding" reached Skills and the headline over a record evidencing none.
//
// The model must now quote the record verbatim for each term. This checks that
// quote and nothing else — no synonym matching, no judgement, no second model.
// The tolerance is the file's existing one (6-character stems), so CZ/PL
// inflection and Manager/Management do not cause a false drop; a CONCEPT
// expressed in different words still passes, because what is checked is the
// quote's presence in the record, not the term's.
function proofSupported(quote, masterText) {
  const q = plain(quote).toLowerCase();
  if (!q) return false;
  const hay = plain(masterText).toLowerCase();
  if (hay.includes(q)) return true;

  const stems = stemSet(masterText);
  const content = plain(quote).split(/\s+/).map(stem).filter(Boolean);
  if (!content.length) return false;
  return content.every((s) => stems.has(s));
}

// Split `ats_keywords_present` into the terms whose proof the record carries and
// the terms whose proof it does not. An entry with no proof at all fails: there
// is no evidence to check.
export function splitProvenKeywords(present, master) {
  const m = readMaster(master);
  const proven = [];
  const unproven = [];
  // No record is no evidence: judge nothing rather than guess.
  if (!m.text) return { proven: Array.isArray(present) ? present : [], unproven };

  for (const entry of Array.isArray(present) ? present : []) {
    const term = typeof entry === 'string' ? entry : String(entry?.term || '').trim();
    if (!term) continue;
    const proof = typeof entry === 'string' ? '' : String(entry?.proof || '').trim();
    if (proof && proofSupported(proof, m.text)) proven.push(entry);
    else unproven.push(term);
  }
  return { proven, unproven };
}

// Industry and domain labels — the words that assert what world the candidate
// worked in. Each is legitimate when the ad or the record supplies it, and an
// invention when neither does. English and CZ/PL forms both appear because the
// letter is written in the market's language; stemming covers the inflections.
const DOMAIN_TERMS = [
  'fintech', 'insurtech', 'regtech', 'proptech', 'adtech', 'martech', 'edtech', 'healthtech',
  'biotech', 'cleantech', 'agritech', 'legaltech', 'hrtech',
  'banking', 'bankovnictvi', 'bankowosc', 'insurance', 'pojistovnictvi', 'ubezpieczenia',
  'blockchain', 'cryptocurrency', 'crypto', 'kryptomeny', 'kryptowaluty', 'web3', 'defi',
  'ecommerce', 'retail', 'maloobchod', 'logistics', 'logistika',
  'telecom', 'telekomunikace', 'automotive', 'automobilovy', 'pharma', 'farmaceuticky',
  'gaming', 'gambling', 'sazkarstvi', 'aerospace', 'defence', 'defense',
  'manufacturing', 'vyroba', 'produkcja', 'healthcare', 'zdravotnictvi',
  'hospitality', 'gastronomie', 'construction', 'stavebnictvi', 'budownictwo',
  'energetika', 'utilities', 'mining', 'agriculture', 'zemedelstvi',
  'saas', 'marketplace', 'startup', 'scaleup',
].reduce((set, w) => {
  const s = stem(w);
  if (s) set.add(s);
  return set;
}, new Set());

// THE MASTER IS THE ONLY SOURCE. The ad was allowed as a second source once, and
// that was the hole: Blogic's own blurb says "specialisté na FinTech", so the ad
// licensed "fintech" and the letter then claimed it as the CANDIDATE's
// background. An ad naming an industry says where the EMPLOYER works — it is
// evidence about them, never about the applicant. Every other Layer 6 check
// traces claims to the master alone; this one now does too.

// The domain words the letter used that neither source gave it, as written. Like
// bannedPhraseHits, this REPORTS TO THE REPAIR PASS, not to the candidate: an
// invented industry is the app's own writing failing, so it is removed before
// delivery rather than handed back as the user's problem to solve.
export function unsourcedDomainHits(document, { master = '' } = {}) {
  const m = readMaster(master);
  // No record is no evidence: report nothing rather than guess.
  if (!m.text) return [];

  const allowed = stemSet(m.text);
  const seen = new Set();
  const stray = [];
  for (const w of plain(coverBody(document)).split(/\s+/)) {
    const s = stem(w);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    if (!DOMAIN_TERMS.has(s) || allowed.has(s)) continue;
    stray.push(w.replace(/[^\p{L}\p{N}-]/gu, ''));
  }
  return stray;
}

// CHECK 24 — A REQUIREMENT THE RECORD CANNOT ANSWER, ASSERTED ANYWAY.
//
// The analysis already computes the terms the job asks for and the record does
// NOT evidence: `analysis.ats_keywords_missing`, shown to the candidate as
// advice. Nothing ever enforced it. A real run (KUBO, 2026-08-16) produced a
// letter claiming "vyhodnocování dat v CRM" over a master record containing no
// occurrence of CRM, Salesforce or any CRM at all — while that same analysis
// listed CRM as missing, twice. The AI verify pass has a BORROWED REQUIREMENT
// category and did not fire: the claim was phrased as routine habit ("I use
// them to…"), not as the loud "extensive X experience" its example describes.
//
// So the check is CODE, over a list the pipeline already computed. It cannot
// hallucinate a violation, and it fires on the exact shape the checker misses.
//
// ACRONYMS ARE WHY THIS DOES NOT REUSE stem(): stem() discards anything under
// four characters, so CRM, SQL, SAP, ERP and every other three-letter
// requirement were structurally invisible to check 23's machinery. Short terms
// are matched whole and case-insensitively; longer ones by stem, so CZ/PL
// inflection still counts as one word.
//
// The MASTER remains the only evidence: a term the record does support is never
// reported, even if a stale analysis still lists it as missing.
function normaliseTerm(t) {
  return String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .trim();
}

// The model writes this list as advice to a human, so its entries drift between
// a bare term ("CRM") and a phrase ("CRM software administration", "B2B sales
// metrics"). A phrase is not a claim any document makes as a unit, so matching
// it whole finds nothing — which is how CRM slipped through twice.
//
// From a phrase we therefore take only its ACRONYMS, capitalised in the source:
// CRM, SAP, SQL, B2B. They are the checkable part — a specific named system or
// standard, which the record either evidences or does not. The ordinary words
// around them ("software", "administration", "outreach", "metrics", "school")
// are deliberately ignored: they are too common to carry a claim, and cutting
// one would damage a true sentence.
// The acronyms in a stretch of text, as written: short, all-caps, at least one
// letter, digits allowed so B2B counts. A named system or standard is the
// checkable part of any requirement — the record either evidences it or does
// not — while the ordinary words around it are too common to carry a claim.
function acronymsIn(text) {
  const out = [];
  for (const token of String(text || '').split(/[\s/,;()[\]]+/)) {
    const bare = token.replace(/[^\p{L}\p{N}]/gu, '');
    if (bare.length >= 2 && bare.length <= 5 && bare === bare.toUpperCase() && /\p{L}/u.test(bare)) {
      out.push(normaliseTerm(bare));
    }
  }
  return out;
}

// THE DENY-LIST IS COMPUTED FROM THE AD, NOT TAKEN FROM THE MODEL.
//
// `ats_keywords_missing` was the only source until 2026-08-16, and it comes out
// of the same call that writes `ats_keywords_present` — under a prompt telling
// that call to be GENEROUS about what counts as present. A term the model
// wrongly reads as earned is, by construction, absent from the missing list, so
// the deny-list is empty in exactly the case that leaks. On the KUBO run it
// caught "CRM" and missed "B2B", "Account Management" and "onboarding", all of
// which had been laundered through `ats_keywords_present` with a proof quote
// nobody checked.
//
// So the ad's own acronyms are read straight off `analysis.job_text`. The
// missing list stays as one input, no longer the source.
//
// The EMPLOYER'S OWN NAME is exempt. An ad names the company and the advertised
// role, and a document may say them — that is a fact about the employer, which
// is exactly what the ad is a source for.
function missingTerms(analysis) {
  const raw = analysis?.analysis?.ats_keywords_missing;
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,;\n]/);
  const out = [];
  for (const item of list) {
    const source = String(item || '').trim();
    if (!source) continue;
    const t = normaliseTerm(source);
    if (!t || t.length < 2) continue;
    if (!t.includes(' ')) { out.push(t); continue; }
    out.push(...acronymsIn(source));
  }
  out.push(...acronymsIn(analysis?.job_text));

  const extraction = analysis?.job_extraction || {};
  const employer = new Set([
    ...acronymsIn(extraction.company),
    ...acronymsIn(extraction.job_title),
  ]);
  return out.filter((t) => !employer.has(t));
}

// Which of the deny-list terms a stretch of the document actually used, with the
// master as veto: a term the record does support is never reported, even if a
// stale analysis still lists it.
function unevidencedIn(text, m, terms) {
  // Edge punctuation only: "CRM." must match "crm", while "node.js" and "c#"
  // keep the punctuation that is part of the name.
  const words = (t) => normaliseTerm(t)
    .split(/\s+/)
    .map((w) => w.replace(/^[.+#-]+/, '').replace(/[.+#-]+$/, ''))
    .filter(Boolean);

  const masterWords = new Set(words(m.text));
  const masterStems = stemSet(m.text);
  const docWords = words(text);
  const docStems = stemSet(text);

  const hits = [];
  const seen = new Set();
  for (const term of terms) {
    if (seen.has(term)) continue;
    seen.add(term);
    const s = stem(term);
    // The master supports it after all — never cut a true claim.
    if (s ? masterStems.has(s) : masterWords.has(term)) continue;
    const used = s ? docStems.has(s) : docWords.includes(term);
    if (used) hits.push(term.toUpperCase().length <= 4 ? term.toUpperCase() : term);
  }
  return hits;
}

export function unevidencedKeywordHits(document, { master = '', analysis = null } = {}) {
  const m = readMaster(master);
  // No record is no evidence: report nothing rather than guess.
  if (!m.text) return [];

  const terms = missingTerms(analysis);
  if (!terms.length) return [];

  return unevidencedIn(coverBody(document), m, terms);
}

// CHECK 26 — THE SAME BORROWED REQUIREMENT, ON THE CV.
//
// Check 24 runs on the letter only, and the CV leaks the same way: the KUBO run
// printed "B2B Client Relations" and "Account Management" in Skills and "B2B
// Account Manager & Tech Enablement Specialist" as the headline, over a record
// that says none of them.
//
// SEVERITY IS BY SLOT, because the slot resolves the ambiguity the term list
// cannot. A Skills entry and a headline are bare assertions with no surrounding
// prose to make them innocent, so a borrowed term there is always a claim about
// the candidate: HARD, which triggers the one regeneration. Prose can carry an
// ad word without asserting it — naming the employer's world, restating the
// requirement being answered — so it is left to the AI verify pass, which reads
// the sentence rather than the word.
//
// Check 14 cannot cover this: it matches five-letter stems against the master as
// one flat string, so "B2B Client Relations" clears on the words "client" and
// "relations" from a 2003 role, and three-letter terms are invisible to it
// entirely.
function checkAdTerms(document, m, analysis, hard) {
  if (!m.text) return;
  const terms = missingTerms(analysis);
  if (!terms.length) return;

  const slots = skillEntries(document);
  const headline = cvHeadline(document);
  if (headline) slots.push(headline);
  if (!slots.length) return;

  for (const hit of unevidencedIn(slots.join('\n'), m, terms)) {
    hard.push(`"${hit}" comes from the job ad and the master record does not evidence it — it cannot be a listed skill or the headline.`);
  }
}

// The headline is the line under the candidate's name: the first bold line
// before the first section heading. An absent one reports nothing.
function cvHeadline(document) {
  for (const line of String(document || '').split('\n')) {
    const t = line.trim();
    if (/^#{2,}\s/.test(t)) break;
    const bold = t.match(/^\*\*(.+)\*\*$/);
    if (bold) return bold[1].trim();
  }
  return '';
}

// CHECK 25 — THE SAME SENTENCE PRINTED TWICE.
//
// Seen on a real letter: "My focus is on user adoption, structured relationship
// building, and client success." appeared verbatim in two paragraphs. In a
// 250-350 word letter a repeated sentence is never intentional — it is the
// writer restating its own point, or span surgery leaving a clause that already
// existed elsewhere. Like the banned phrases and the invented domains, this is
// the app's own writing failing, so it is REMOVED before delivery rather than
// reported to the candidate — and deterministically, with no second AI call.
//
// Only exact repeats (after folding case, spacing and punctuation) are cut, and
// only the LATER occurrence, so the argument keeps the sentence where it first
// earned its place. Anything under six words is left alone: a short line may be
// a deliberate echo, and the cost of cutting a real one is higher than the cost
// of leaving it.
export function stripDuplicateSentences(document) {
  const text = String(document || '');
  if (!text.trim()) return text;

  const key = (s) => normaliseTerm(s).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const seen = new Set();
  let out = text;

  // Sentence-ish spans: keep the terminator with the sentence so removing one
  // does not weld its neighbours together.
  const sentences = text.match(/[^.!?\n]+[.!?]+/g) || [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    const k = key(sentence);
    if (!k || k.split(' ').length < 6) continue;
    if (!seen.has(k)) { seen.add(k); continue; }
    // A later exact repeat: cut it, then tidy the spacing it leaves behind.
    const at = out.lastIndexOf(sentence);
    if (at < 0) continue;
    out = out.slice(0, at) + out.slice(at + sentence.length);
  }

  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// The cover letter's slice of Layer 6 (checks 17-23). The letter has no
// sections, dates or bullets, so most of validateCv does not apply to it — but
// the banned-phrase list does, the letter is prose and that is exactly where the
// boilerplate wrapper ("I am writing to express my interest") lands, and the
// letter's own rules (word band, matched pairs, salutation, one objection) are
// checkable here and nowhere else. Same { code, params } warnings, so the UI
// renders both documents' findings through the one translation path.
//
// The word band is the only HARD failure: it is arithmetic, the caller can act
// on it, and a letter over its market's ceiling is the one defect the candidate
// cannot see by reading. Under the band is not a failure — a finished argument
// is allowed to stop early.
export function validateCoverLetter(document, { master = '', analysis = null, language = 'auto', tweak = '' } = {}) {
  const hard = [];
  const warnings = [];
  const m = readMaster(master);
  const body = coverBody(document);

  // CHECK 12 DOES NOT RUN ON THE LETTER.
  //
  // On the CV an epithet is a category asserted where evidence belongs, and the
  // check earns its place. In a LETTER the same words are ordinary persuasive
  // English — "As an experienced product leader, I…" opens a letter that Nik
  // judged far better than anything this pipeline produced, and warning about
  // it taught nothing. The letter exists to persuade (CV_RULES.md, "What the
  // cover letter IS"); a rule that makes it more compliant and less persuasive
  // is removed rather than obeyed. The invariants still bind: an epithet that
  // states a FACT the record lacks ("expert in Kubernetes") is caught by the
  // verify pass, which is where a truth problem belongs.

  const { max } = coverWordBand(analysis);
  const count = words(body).length;
  if (count > max) {
    hard.push(`The letter body runs to ${count} words; this market's ceiling is ${max}. Cut it to length without dropping the argument.`);
  }

  // The contract (checks 26-30) — hard, on the same regeneration mechanism as
  // the word band above.
  checkCoverLanguage(body, language, hard);
  checkCoverRedFlag(body, analysis, hard);
  checkCoverSteering(body, tweak, master, hard);

  checkCoverRequirements(body, analysis, hard, master);
  checkCoverNamesEmployer(body, analysis, hard);
  checkCoverSalutation(document, analysis, warnings);
  checkCoverObjections(body, analysis, warnings);
  checkCoverNumbers(body, m, warnings);

  return { ok: hard.length === 0, hard, warnings };
}

// ---- 24. the letter's SHAPE (CV_RULES.md Layer 6, check 24) -----------------
//
// What a reader recognises as machine writing is structural before it is
// lexical: every sentence the same length, every paragraph the same weight, the
// point always arriving in the same place. Word choice can be perfect and the
// page still reads as a machine.
//
// Three things about shape are measurable, and only these three are claimed:
//   shortest  — the shortest sentence in the letter. A human who writes with any
//               rhythm goes short somewhere; a first draft never does.
//   spread    — the standard deviation of sentence length. A draft that holds
//               every sentence between 18 and 28 words has none.
//   longest   — the longest paragraph. Uniform slabs are the machine's default.
//
// This measures flatness, NOT quality. A letter can pass every threshold here
// and still be a bad letter; nothing in this file can tell you otherwise. It
// exists to catch the obvious tell, and it is only applied where the candidate
// has a recorded voice to be flat against.

// Sentences of the letter's body, as word counts. Abbreviations are not worth
// modelling here — one mis-split sentence moves a standard deviation by nothing.
function sentenceLengths(body) {
  return plain(body)
    .split(/(?<=[.!?…])\s+/)
    .map((s) => words(s).length)
    .filter((n) => n > 0);
}

function paragraphLengths(body) {
  return String(body || '')
    .split(/\n\s*\n/)
    .map((p) => words(p).length)
    .filter((n) => n > 0);
}

function stdev(nums) {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
}

// The thresholds. Deliberately loose: they must fire on the flat draft every
// time and never on a letter that genuinely varies, because the repair costs a
// full rewrite. A letter with no sentence under 8 words has no rhythm at all;
// a spread under 5 means every sentence is the same length; a paragraph over
// 100 words is a slab whatever it says.
const SHAPE_LIMITS = { shortestMax: 7, spreadMin: 5, longestParaMax: 100 };

export function coverShape(document) {
  const body = coverBody(document);
  const sentences = sentenceLengths(body);
  const paragraphs = paragraphLengths(body);
  if (!sentences.length) return null;
  return {
    shortest: Math.min(...sentences),
    longest: Math.max(...sentences),
    spread: Number(stdev(sentences).toFixed(1)),
    longestParagraph: paragraphs.length ? Math.max(...paragraphs) : 0,
    sentences: sentences.length,
  };
}

// The reasons this letter reads flat, in plain words the rewrite prompt can act
// on. Empty means it does not. Returns [] when there is nothing to judge — a
// letter with two sentences has no shape to measure.
export function coverShapeFaults(document) {
  const s = coverShape(document);
  if (!s || s.sentences < 4) return [];
  const faults = [];
  if (s.shortest > SHAPE_LIMITS.shortestMax) {
    faults.push(`The shortest sentence in the letter is ${s.shortest} words. Nothing in it ever goes short, so it has no rhythm — it reads at one unbroken pace from the first line to the last.`);
  }
  if (s.spread < SHAPE_LIMITS.spreadMin) {
    faults.push(`Sentence lengths barely vary (spread ${s.spread}, shortest ${s.shortest}, longest ${s.longest}). Every sentence lands at the same weight, which is the clearest signal of machine writing there is.`);
  }
  if (s.longestParagraph > SHAPE_LIMITS.longestParaMax) {
    faults.push(`The longest paragraph runs to ${s.longestParagraph} words — a slab. Paragraphs of one uniform size are a machine's default shape.`);
  }
  return faults;
}

// ---- 24b. the letter's BREADTH (CV_RULES.md Layer 3, depth not coverage) -----
//
// Every early run of the rewritten letter named five or six employers. That is a
// career summary with a salutation on top: the CV already lists all of them, and
// a letter that walks them proves nothing about any one of them.
//
// The rule is prose ("go deep on two"), so a model obeys it most of the time and
// this is the part code can settle: count how many of the master's employers the
// letter names. It is measured against the MASTER, so a company mentioned because
// the ad names it (the employer being written to) is not counted — it is not in
// the candidate's record.
//
// The fault feeds the same voice rewrite that fixes shape, because the remedy is
// the same one: cut. Dropping an employer invents nothing.
const BREADTH_MAX = 3;

// The employer names the master records — INCLUDING the nested contracts[] of a
// merged parent entry. A standing consultancy carries its engagements as
// children (Salsita, wflow.com, SpecialAgents.pro all hang under one Nik Page
// Ltd. entry), and those are exactly the names a letter walks. Reading only the
// top level found three employers where the letter had named five, so the check
// never fired on the case it was written for.
function masterEmployers(master) {
  const m = readMaster(master);
  const out = [];
  // parsed.experience is already flat — readMaster walked the nesting — so an
  // engagement's employer counts as its own name, not the consultancy's.
  for (const e of Array.isArray(m.parsed?.experience) ? m.parsed.experience : []) {
    const name = String(e?.company || '').trim();
    if (name.length > 3) out.push(name);
  }
  return [...new Set(out)];
}

// A name counts as present when its most distinctive word appears in the letter —
// "Salsita" for "Salsita Software", "spořitelna" for "Česká spořitelna" — so a
// letter naming the company informally still counts.
function namesEmployer(text, employer) {
  const parts = employer.toLowerCase().split(/[\s,.]+/).filter((w) => w.length > 3);
  const key = parts.sort((a, b) => b.length - a.length)[0];
  return key ? text.includes(key) : false;
}

export function coverBreadthFault(document, master) {
  const employers = masterEmployers(master);
  if (employers.length <= BREADTH_MAX) return null;
  const text = plain(coverBody(document)).toLowerCase();
  const named = employers.filter((e) => namesEmployer(text, e));
  if (named.length <= BREADTH_MAX) return null;
  return `The letter names ${named.length} of this candidate's employers (${named.join(', ')}). That is a career summary — the CV already lists every one of them. Keep the TWO strongest for this job, prove those properly, and cut the rest: dropping them invents nothing and loses nothing, because they are still on the CV.`;
}
