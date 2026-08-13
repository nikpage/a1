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
import { salutationName } from '../prompts/cover-blueprint.js';

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
  return (String(text || '').replace(/(\d)[.,\s](?=\d{3}\b)/g, '$1').match(/\d+/g) || []);
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

// The master as searchable text, plus its parsed form when it is JSON.
function readMaster(master) {
  const text = typeof master === 'string' ? master : JSON.stringify(master || '');
  let parsed = null;
  try {
    parsed = typeof master === 'string' ? JSON.parse(master) : master;
  } catch {
    parsed = null;
  }
  return { text, lower: text.toLowerCase(), parsed: parsed && typeof parsed === 'object' ? parsed : null };
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
  const sections = splitSections(document);
  for (const s of sections) {
    for (const role of parseRoles(s)) {
      if (isEarlierCareer(role.title)) continue;
      const title = role.title.toLowerCase();
      if (title && !master.lower.includes(title)) {
        // The employer is the harder signal — a title may legitimately be
        // relabelled in wording only if the master states it, so check both and
        // fail only when neither is found.
        const company = plain(role.subtitle).split('|')[0].trim().toLowerCase();
        if (!company || !master.lower.includes(company)) {
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

// 19. With a job ad, the letter carries its three matched pairs. Code cannot
//     judge whether a pairing persuades, but it can see whether the pair reached
//     the page at all: a pair counts only when the letter carries something
//     distinctive from BOTH halves — the requirement and the evidence that
//     answers it. Fewer than the blueprint planned is reported to the candidate.
function checkCoverPairs(body, analysis, warnings) {
  const pairs = analysis?.generation_framework?.cover_blueprint?.matched_pairs;
  if (!Array.isArray(pairs) || pairs.length === 0) return;
  const text = body.toLowerCase();
  const present = pairs.filter((p) => {
    const req = distinctiveTokens(p?.requirement);
    const ev = distinctiveTokens(p?.evidence);
    if (!req.length || !ev.length) return false;
    return halfPresent(text, req) && halfPresent(text, ev);
  }).length;
  if (present < pairs.length) {
    warnings.push({ code: 'coverPairsMissing', params: { present, planned: pairs.length } });
  }
}

// 20. The salutation addresses the contact the job data names. A named contact
//     left as "Dear Hiring Manager" is the cheapest tell in the letter.
function checkCoverSalutation(document, analysis, warnings) {
  const name = salutationName(analysis);
  if (!name) return;
  const line = String(document || '').split('\n').find((l) => /^\s*(dear|vážen|szanown)/i.test(l));
  if (!line) return;
  const first = name.split(/\s+/)[0].toLowerCase();
  if (!plain(line).toLowerCase().includes(first)) {
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

// The cover letter's slice of Layer 6 (checks 17-22). The letter has no
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
export function validateCoverLetter(document, { master = '', analysis = null, language = 'auto' } = {}) {
  const hard = [];
  const warnings = [];
  const m = readMaster(master);
  const body = coverBody(document);

  checkEpithets(document, warnings);

  const { max } = coverWordBand(analysis);
  const count = words(body).length;
  if (count > max) {
    hard.push(`The letter body runs to ${count} words; this market's ceiling is ${max}. Cut it to length without dropping the argument.`);
  }

  checkCoverPairs(body, analysis, warnings);
  checkCoverSalutation(document, analysis, warnings);
  checkCoverObjections(body, analysis, warnings);
  checkCoverNumbers(body, m, warnings);

  return { ok: hard.length === 0, hard, warnings };
}
