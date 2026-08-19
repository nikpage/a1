// prompts/analysis-brief.test.js
//
// The generation brief is the wall between the two halves of the deep analysis:
// the blueprint half is executed by the writers, the review half is read by the
// candidate. These tests pin the real prompt strings the builders emit — they
// fail the moment review copy leaks back into a writer's prompt, or the moment
// a field the writer prompts actually name stops reaching it.

import { describe, test, expect } from 'vitest';
import { generationBrief } from './analysis-brief.js';
import { buildCvPrompt } from './cv-generator.js';
import { buildCoverPrompt } from './cover-letter.js';

const MASTER = JSON.stringify({
  identity: { name: 'Jane Doe' },
  experience: [{ role: 'Head of Ops', company: 'Acme GmbH', dates: '03/2019 - 06/2024' }],
});

// A merged analysis exactly as the worker stores it: teaser + blueprint + review
// in one object. Every distinctive string below is unique so a leak is provable.
const ANALYSIS = {
  // --- teaser half (display) ---
  cv_data: { Name: 'Jane Doe', Seniority: 'Senior', Industry: 'Logistics', Country: 'Germany' },
  summary: 'TEASER_TLDR_SENTINEL',
  analysis: {
    scenario_tags: ['Standard Career Progression'],
    ats_verdict: 'fail',
    ats_reason: 'ATS_REASON_SENTINEL',
    ats_snags: [{ point: 'ATS_SNAG_SENTINEL', detail: 'two columns scramble' }],
    scan_verdict: 'fail',
    scan_reason: 'SCAN_REASON_SENTINEL',
    scan_snags: [{ point: 'SCAN_SNAG_SENTINEL', detail: 'An 11-month tenure.' }],
    buried_credentials: [{ tag: 'CLIENT', name: 'BURIED_CRED_SENTINEL' }],
    hr_first_seconds: 'HR_FLASH_SENTINEL',
    nuance_clarifications: ['NUANCE_SENTINEL'],
    // --- review half (display) ---
    overall_score: '6',
    ats_score: '4',
    overall_commentary: 'OVERALL_COMMENTARY_SENTINEL',
    cv_format_analysis: 'FORMAT_ANALYSIS_SENTINEL',
    cultural_fit: 'CULTURAL_FIT_SENTINEL',
    style_wording: 'STYLE_WORDING_SENTINEL',
    suitable_positions: ['SUITABLE_POSITION_SENTINEL'],
    // --- blueprint half (executed) ---
    career_arc: 'CAREER_ARC_KEEP',
    parallel_experience: 'PARALLEL_KEEP',
    transferable_skills: 'TRANSFERABLE_KEEP',
    red_flags: ['RED_FLAG_KEEP'],
    ats_keywords_present: 'KEYWORD_PRESENT_KEEP',
    ats_keywords_missing: 'KEYWORD_MISSING_KEEP',
    quick_wins: ['QUICK_WIN_KEEP'],
    action_items: {
      cv_changes: { critical: ['CV_CHANGE_KEEP'], advised: [], optional: [] },
      'Cover Letter': { 'Points to Address': ['COVER_POINT_KEEP'], 'Narrative Flow': [], 'Tone and Style': [] },
    },
  },
  final_thought: 'FINAL_THOUGHT_SENTINEL',
  job_data: { Position: 'Operations Director', Country: 'Germany' },
  jobs_extracted: [{ title: 'Head of Ops', company: 'Acme GmbH' }],
  job_match: { positioning_strategy: 'POSITIONING_KEEP', career_scenario: 'Standard Career Progression' },
  generation_framework: {
    cv_blueprint: {
      target_length_pages: '2 pages',
      section_order: ['Summary', 'Skills', 'Work Experience', 'Education'],
      headline_draft: 'HEADLINE_DRAFT_KEEP',
      summary_draft: 'SUMMARY_DRAFT_KEEP',
      top_three_achievements: ['ACHIEVEMENT_KEEP'],
      skills_to_highlight: ['SKILL_KEEP'],
      job_selection: { include_jobs: ['INCLUDE_JOB_KEEP'], condense_jobs: [], rewrite_jobs: [] },
    },
    target_cover_words: 275,
  },
  job_extraction: { position_title: 'Operations Director', must_have_requirements: ['MUST_HAVE_SENTINEL'] },
};

const WITHHELD = [
  'TEASER_TLDR_SENTINEL',
  'ATS_REASON_SENTINEL', 'ATS_SNAG_SENTINEL',
  'SCAN_REASON_SENTINEL', 'SCAN_SNAG_SENTINEL',
  'BURIED_CRED_SENTINEL', 'HR_FLASH_SENTINEL', 'NUANCE_SENTINEL',
  'OVERALL_COMMENTARY_SENTINEL', 'FORMAT_ANALYSIS_SENTINEL',
  'CULTURAL_FIT_SENTINEL', 'STYLE_WORDING_SENTINEL',
  'SUITABLE_POSITION_SENTINEL', 'FINAL_THOUGHT_SENTINEL',
];

const KEPT = [
  'POSITIONING_KEEP', 'CAREER_ARC_KEEP', 'PARALLEL_KEEP',
  'TRANSFERABLE_KEEP', 'RED_FLAG_KEEP', 'KEYWORD_PRESENT_KEEP', 'HEADLINE_DRAFT_KEEP',
  'SUMMARY_DRAFT_KEEP', 'ACHIEVEMENT_KEEP', 'SKILL_KEEP', 'INCLUDE_JOB_KEEP',
];

// Dropped from the CV's brief on 2026-08-16, when the prompt stopped restating
// the rule stack: each of these only worked because a line of that stack
// explained it. ats_keywords_missing is a PROHIBITION that now reads as data;
// quick_wins and action_items are advice to the candidate about the CV they
// already have, and unlabelled advice is answered one sentence at a time.
const DROPPED = ['KEYWORD_MISSING_KEEP', 'QUICK_WIN_KEEP', 'CV_CHANGE_KEEP', 'COVER_POINT_KEEP'];

const userOf = (msgs) => msgs.find((m) => m.role === 'user').content;

describe('generationBrief projection', () => {
  test('withholds every display-only field', () => {
    const json = JSON.stringify(generationBrief(ANALYSIS));
    for (const sentinel of WITHHELD) expect(json).not.toContain(sentinel);
  });

  test('keeps every field the generator prompts name', () => {
    const json = JSON.stringify(generationBrief(ANALYSIS));
    for (const sentinel of KEPT) expect(json).toContain(sentinel);
  });

  test('withholds the prohibition and the advice written about the OLD CV', () => {
    const json = JSON.stringify(generationBrief(ANALYSIS));
    for (const sentinel of DROPPED) expect(json).not.toContain(sentinel);
  });

  // The master CV is already in the prompt in full; a second copy of the same
  // career invites the document to walk it.
  test('does not ship the career a second time', () => {
    expect(generationBrief(ANALYSIS)).not.toHaveProperty('jobs_extracted');
  });

  test('drops the scores outright rather than passing a stale verdict', () => {
    const brief = generationBrief(ANALYSIS);
    expect(brief.analysis.overall_score).toBeUndefined();
    expect(brief.analysis.ats_score).toBeUndefined();
    expect(brief.analysis.scenario_tags).toEqual(['Standard Career Progression']);
  });

  test('omits empty fields instead of emitting hollow keys', () => {
    const brief = generationBrief({
      jobs_extracted: [],
      job_match: {},
      analysis: { red_flags: [], career_arc: 'REAL' },
    });
    expect(brief).not.toHaveProperty('jobs_extracted');
    expect(brief).not.toHaveProperty('job_match');
    expect(brief.analysis).toEqual({ career_arc: 'REAL' });
  });

  test('survives a missing or malformed analysis', () => {
    expect(generationBrief(null)).toEqual({});
    expect(generationBrief('not an object')).toEqual({});
    expect(generationBrief({})).toEqual({});
  });
});

describe('the CV prompt carries the brief, not the review', () => {
  const prompt = userOf(buildCvPrompt(MASTER, ANALYSIS, 'professional'));

  test('no display copy reaches the CV writer', () => {
    for (const sentinel of WITHHELD) expect(prompt).not.toContain(sentinel);
  });

  test('the blueprint the writer executes still reaches it', () => {
    for (const sentinel of KEPT) expect(prompt).toContain(sentinel);
  });

  test('and the dropped fields reach no writer at all', () => {
    for (const sentinel of DROPPED) expect(prompt).not.toContain(sentinel);
  });

  test('the job ad still reaches it via the target-job block, stated once', () => {
    expect(prompt).toContain('MUST_HAVE_SENTINEL');
    expect(prompt.split('MUST_HAVE_SENTINEL')).toHaveLength(2);
  });
});

describe('the cover-letter prompt carries the brief, not the review', () => {
  const prompt = userOf(buildCoverPrompt(MASTER, ANALYSIS, 'professional'));

  test('no display copy reaches the cover writer', () => {
    for (const sentinel of WITHHELD) expect(prompt).not.toContain(sentinel);
  });

  // coverBrief itself stays gone (2026-08-15): the letter does not receive the
  // analysis's projection of a document. What reaches it from the analysis is
  // the ad, the market word band, and — since 2026-08-19 — the gathered
  // EVIDENCE and the flags a recruiter would raise, as material it may use or
  // ignore. Positioning strategy and CV-change guidance stay out: those tell
  // the writer how to frame, which is the plan the writer owns.
  test('the writer gets evidence and flags, never the analysis\'s framing guidance', () => {
    expect(prompt).not.toContain('COVER_POINT_KEEP');
    expect(prompt).not.toContain('POSITIONING_KEEP');
    expect(prompt).not.toContain('CV_CHANGE_KEEP');
    // The flags reach it as material — contract clause C2 binds for every
    // applicant, and a flag the writer never sees cannot be answered.
    expect(prompt).toContain('RED_FLAG_KEEP');
    // The word band still reaches it: length is furniture, not guidance.
    expect(prompt).toContain('275');
  });
});
