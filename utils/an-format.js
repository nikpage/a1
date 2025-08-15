// utils/an-format.js
const logPrefix = '[finalizeAnalysisJson]';

export function finalizeAnalysisJson(input, { language, hasJobText }) {
  console.info(`${logPrefix} start`, { language, hasJobText });
  const out = clone(input || {});
  ensureKeys(out, language, hasJobText);
  renameCoverLetter(out);
  moveQuickWins(out);
  sanitizeBullets(out);
  ensureScores(out);
  out.generation_framework = buildFramework(out);
  console.info(`${logPrefix} done`, {
    keys: Object.keys(out),
    cvData: out.cv_data,
    jobData: out.job_data
  });
  return out;
}

function ensureKeys(obj, language, hasJobText) {
  obj.summary = obj.summary || '';
  obj.cv_data = obj.cv_data || { Name: '', Seniority: '', Industry: '', Country: '' };
  obj.job_data = obj.job_data || {
    Position: hasJobText ? '' : 'n/a',
    Seniority: hasJobText ? '' : 'n/a',
    Company: hasJobText ? '' : 'n/a',
    Industry: hasJobText ? '' : 'n/a',
    Country: hasJobText ? '' : 'n/a',
    'HR Contact': hasJobText ? '' : 'n/a'
  };
  obj.jobs_extracted = Array.isArray(obj.jobs_extracted) ? obj.jobs_extracted : [];
  obj.analysis = obj.analysis || {};
  obj.analysis.scenario_tags = Array.isArray(obj.analysis.scenario_tags) ? obj.analysis.scenario_tags : [];
  obj.analysis.red_flags = obj.analysis.red_flags || '';
  obj.analysis.overall_commentary = obj.analysis.overall_commentary || '';
  obj.analysis.cv_format_analysis = obj.analysis.cv_format_analysis || '';
  obj.analysis.cultural_fit = obj.analysis.cultural_fit || '';
  obj.analysis.suitable_positions = obj.analysis.suitable_positions || '';
  obj.analysis.career_arc = obj.analysis.career_arc || '';
  obj.analysis.parallel_experience = obj.analysis.parallel_experience || '';
  obj.analysis.transferable_skills = obj.analysis.transferable_skills || '';
  obj.analysis.style_wording = obj.analysis.style_wording || '';
  obj.analysis.ats_keywords = obj.analysis.ats_keywords || '';
  obj.analysis.action_items = obj.analysis.action_items || {};
  obj.analysis.action_items.cv_changes = obj.analysis.action_items.cv_changes || { critical: [], advised: [], optional: [] };
  obj.analysis.action_items['Cover Letter'] = obj.analysis.action_items['Cover Letter'] || {
    'Points to Address': [],
    'Narrative Flow': [],
    'Tone and Style': []
  };
  obj.job_match = obj.job_match || {
    keyword_match: hasJobText ? '' : 'n/a',
    inferred_keywords: hasJobText ? '' : 'n/a',
    career_scenario: hasJobText ? '' : 'n/a',
    positioning_strategy: hasJobText ? '' : 'n/a'
  };
  obj.final_thought = obj.final_thought || '';
  obj.analysis.quick_wins = obj.analysis.quick_wins || '';
  obj.language = language || obj.language || 'English';
}

function renameCoverLetter(obj) {
  const ai = obj.analysis?.action_items || {};
  if (ai.cover_letter_guidance && !ai['Cover Letter']) {
    const cl = ai.cover_letter_guidance;
    const mapped = {
      'Points to Address': cl.critical_points_to_address || [],
      'Narrative Flow': cl.suggested_narrative_flow || [],
      'Tone and Style': cl['Tone and Style'] || cl.tone_and_style || []
    };
    ai['Cover Letter'] = mapped;
    delete ai.cover_letter_guidance;
  }
  if (Array.isArray(ai['Cover Letter']?.critical_points_to_address)) {
    ai['Cover Letter']['Points to Address'] = ai['Cover Letter']['Points to Address'] || ai['Cover Letter'].critical_points_to_address;
    delete ai['Cover Letter'].critical_points_to_address;
  }
  if (Array.isArray(ai['Cover Letter']?.suggested_narrative_flow)) {
    ai['Cover Letter']['Narrative Flow'] = ai['Cover Letter']['Narrative Flow'] || ai['Cover Letter'].suggested_narrative_flow;
    delete ai['Cover Letter'].suggested_narrative_flow;
  }
}

function moveQuickWins(obj) {
  const txt = String(obj.analysis.quick_wins || '').trim();
  if (!txt) return;
  const bullets = splitBullets(txt);
  const critical = obj.analysis.action_items.cv_changes.critical;
  for (const b of bullets) critical.push(b);
  obj.analysis.quick_wins = '';
  const kwPlan = toArray(obj.analysis.keyword_integration_plan);
  if (kwPlan.length) {
    const advised = obj.analysis.action_items.cv_changes.advised;
    for (const b of kwPlan) advised.push(b);
    delete obj.analysis.keyword_integration_plan;
  }
}

function sanitizeBullets(obj) {
  const paths = [
    ['analysis', 'red_flags'],
    ['analysis', 'suitable_positions'],
    ['analysis', 'transferable_skills'],
    ['analysis', 'ats_keywords']
  ];
  for (const p of paths) {
    const v = get(obj, p);
    if (typeof v === 'string') set(obj, p, normalizeBulletedText(v));
  }
  const cvC = obj.analysis.action_items.cv_changes;
  cvC.critical = normalizeBulletArray(cvC.critical);
  cvC.advised = normalizeBulletArray(cvC.advised);
  cvC.optional = normalizeBulletArray(cvC.optional);
  const cl = obj.analysis.action_items['Cover Letter'];
  cl['Points to Address'] = normalizeBulletArray(cl['Points to Address']);
  cl['Narrative Flow'] = normalizeBulletArray(cl['Narrative Flow']);
  cl['Tone and Style'] = normalizeBulletArray(cl['Tone and Style']);
}

function ensureScores(obj) {
  const s = obj.analysis;
  s.overall_score = coerceScore(s.overall_score);
  s.ats_score = coerceScore(s.ats_score);
}

function buildFramework(obj) {
  const seniority = (obj.cv_data?.Seniority || '').toLowerCase();
  const jobs = Array.isArray(obj.jobs_extracted) ? obj.jobs_extracted : [];
  const years = estimateYears(jobs);
  const targetLength = seniority.match(/lead|director|head|principal|senior/) || years >= 10 ? 2 : 1;
  const cvBlueprint = {
    target_length_pages: targetLength,
    section_order: ['Professional Summary', 'Key Skills', 'Professional Experience', 'Education', 'Additional'],
    job_selection: { include_jobs: 'most_recent_relevant', condense_jobs: 'older_than_10y', rewrite_jobs: 'align_with_job_match' },
    summary_rewrite: 'Outcome-focused summary aligned to positioning_strategy and scenario_tags',
    skills_to_highlight: deriveSkills(obj)
  };
  const clBlueprint = {
    tone: 'professional',
    required_points: obj.analysis.action_items['Cover Letter']['Points to Address'],
    narrative_flow: obj.analysis.action_items['Cover Letter']['Narrative Flow'],
    style_notes: obj.analysis.action_items['Cover Letter']['Tone and Style']
  };
  return { cv_blueprint: cvBlueprint, cover_letter_blueprint: clBlueprint };
}

function deriveSkills(obj) {
  const text = `${obj.analysis.transferable_skills}\n${obj.analysis.ats_keywords}`.toLowerCase();
  const raw = splitBullets(text).map(s => s.replace(/^[-•]\s*/, '').trim());
  const set = new Set();
  for (const r of raw) if (r && r.length <= 60) set.add(capitalize(r));
  return Array.from(set).slice(0, 24);
}

function estimateYears(jobs) {
  const years = [];
  for (const j of jobs) {
    const sd = parseYearMonth(j.start_date);
    const ed = j.end_date && j.end_date !== 'ongoing' ? parseYearMonth(j.end_date) : new Date();
    if (!sd) continue;
    const diff = (ed - sd) / (1000 * 60 * 60 * 24 * 365.25);
    if (diff > 0 && diff < 60) years.push(diff);
  }
  return Math.round(years.reduce((a, b) => a + b, 0));
}

function parseYearMonth(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/(\d{4})[-/\. ]?(\d{1,2})?/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = m[2] ? Math.min(12, Math.max(1, parseInt(m[2], 10))) : 1;
  return new Date(Date.UTC(y, mo - 1, 1));
}

function splitBullets(txt) {
  if (!txt) return [];
  const t = String(txt).replace(/\r\n/g, '\n');
  const parts = t.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const q = p.replace(/^[-•]\s*/, '').trim();
    if (q) out.push(q);
  }
  return out;
}

function normalizeBulletedText(s) {
  const items = splitBullets(s);
  return items.map(i => `• ${i}`).join('\n');
}

function normalizeBulletArray(arr) {
  const a = Array.isArray(arr) ? arr : toArray(arr);
  const clean = [];
  for (const x of a) {
    const v = String(x || '').replace(/^[-•]\s*/, '').trim();
    if (v) clean.push(`• ${v}`);
  }
  return clean;
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  if (typeof v === 'string') return splitBullets(v);
  return [];
}

function coerceScore(v) {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, Math.min(10, Math.round(n)));
  return '';
}

function clone(o) {
  return JSON.parse(JSON.stringify(o || {}));
}

function get(obj, pathArr) {
  return pathArr.reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), obj);
}

function set(obj, pathArr, val) {
  let cur = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    const k = pathArr[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[pathArr[pathArr.length - 1]] = val;
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
