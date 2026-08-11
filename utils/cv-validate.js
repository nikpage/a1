// utils/cv-validate.js
//
// LAYER 6 — output validation. Deterministic code, not a prompt: the CV rules
// in prompts/cv-rules.js tell the writer what to do, and this checks whether it
// actually did. Nothing here calls an AI, so it cannot hallucinate a violation.
//
// Two severities, exactly as the rules define them:
//   hard[]     — checks 1-4. A hard failure means the document must not ship as
//                is; the caller regenerates once with the failures fed back.
//   warnings[] — checks 5-9. Surfaced to the user, never blocking.
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

// 2. Dates match the master, and every dated experience entry is MM/YYYY.
function checkDates(document, master, hard) {
  const sections = splitSections(document);
  const exp = sections.find((s) => parseRoles(s).length > 0);
  if (!exp) return;
  const text = exp.lines.join('\n');

  // Format: any year in the experience section must be part of an MM/YYYY pair.
  const yearMatches = text.match(/\b(19|20)\d{2}\b/g) || [];
  const mmYyyy = text.match(/\b(0[1-9]|1[0-2])\/((19|20)\d{2})\b/g) || [];
  if (yearMatches.length !== mmYyyy.length) {
    hard.push('Work Experience contains a date that is not in MM/YYYY form — one date format is required throughout.');
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

// 5. Impact zone: the Summary is prose within ~120 words — headline + proposition.
function checkImpactZone(document, warnings) {
  const sections = splitSections(document);
  const summary = sections[0];
  if (!summary) {
    warnings.push({ code: 'noSections' });
    return;
  }
  // The Summary is prose. Bullets there duplicate Work Experience and push the
  // value proposition out of the space a recruiter actually reads.
  const bullets = summary.lines.filter((l) => /^\s*[-*•]\s+/.test(l));
  if (bullets.length > 0) {
    warnings.push({ code: 'summaryBullets', params: { count: bullets.length } });
  }
  const count = words(summary.lines.join(' ')).length;
  if (count > 120) warnings.push({ code: 'impactZoneWords', params: { count } });
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

// ---- the validator ----------------------------------------------------------

export function validateCv(document, { master = '', analysis = null, language = 'auto' } = {}) {
  const hard = [];
  const warnings = [];
  const m = readMaster(master);

  checkNumbersTrace(document, m, hard);
  checkDates(document, m, hard);
  checkRolesReal(document, m, hard);
  checkStructure(document, analysis, hard);

  checkImpactZone(document, warnings);
  checkBullets(document, m, language, warnings);
  checkMarket(document, m, warnings);
  checkGaps(analysis, warnings);
  checkProjects(document, analysis, warnings);

  return { ok: hard.length === 0, hard, warnings };
}

// The correction note fed back to the generator on a hard failure — the same
// rules, pointed at what the document actually got wrong.
export function validationFeedback(hard) {
  return `# Output validation FAILED — fix these before returning the CV
Your previous draft broke rules that cannot be broken. Regenerate the CV, keeping everything that was right and fixing exactly these:
${hard.map((h) => `- ${h}`).join('\n')}

Fix them WITHOUT inventing anything: correct a wrong number by using the master's number or cutting the claim, correct a date by copying the master's date, remove any entry that is not a real role, and express any structure with plain single-column markdown.`;
}
