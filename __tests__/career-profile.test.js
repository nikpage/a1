// The career profile is the job-agnostic half of the analysis, built once per
// record. These pin the three things that make it worth having: it never
// invents a target job; a per-job analysis handed one STOPS ASKING for the half
// that is already settled (which is the whole saving); and the timeline it
// reasons about is counted in code, not by the model.
vi.hoisted(() => { process.env.NODE_ENV = 'test'; });

import { describe, test, expect, vi } from 'vitest';
import { buildCareerProfilePrompt } from '../prompts/career-profile.js';
import { buildAnalysisPrompt } from '../prompts/analysis.js';

const MASTER = {
  work_experience: [
    { company: 'Nik Page Ltd.', title: 'Consultant', start_date: 'August 2016', end_date: 'Present',
      fractional_engagements: [{ company: 'Salsita', title: 'Sr. PM', start_date: 'November 2022', end_date: 'October 2023' }] },
  ],
};
const RECORD = JSON.stringify(MASTER);
const NOW = new Date('2026-08-20');

describe('buildCareerProfilePrompt', () => {
  const [sys, usr] = buildCareerProfilePrompt(RECORD, MASTER, NOW);

  test('carries the record and asks only for job-agnostic fields', () => {
    expect(usr.content).toContain('Nik Page Ltd.');
    expect(usr.content).toContain('"standing_risks"');
    expect(usr.content).toContain('"proven_keywords"');
    // the scenario handling text mentions positioning_strategy in prose; what
    // must be absent is any job-shaped SLOT in the schema it returns.
    const schema = usr.content.split('JSON OUTPUT SCHEMA:')[1];
    expect(schema).not.toContain('positioning_strategy');
    expect(schema).not.toContain('ats_keywords_missing');
    expect(schema).not.toContain('job_extraction');
    expect(schema).not.toContain('cv_blueprint');
  });

  test('forbids inventing a target job and names the real nested key', () => {
    expect(sys.content).toMatch(/Do NOT invent a target role/i);
    expect(sys.content).toMatch(/work_experience\[\]\.fractional_engagements\[\]/);
    expect(sys.content).toMatch(/never count the nested children as job-hopping/i);
  });

  test('bars the scenario block\'s own vocabulary from being echoed as an observation', () => {
    expect(usr.content).toMatch(/NEVER quote its vocabulary back/i);
  });

  // The prose rule above was already there when the profile reported "apparent
  // job-hopping — Salsita 11 months" about a person who has held one thing
  // since 2016. The counting is no longer the model's to do.
  test('hands over the code-counted timeline and makes it authoritative', () => {
    expect(usr.content).toContain('TIMELINE — COMPUTED FROM THIS RECORD IN CODE');
    expect(usr.content).toContain('Positions actually held: 1');
    expect(usr.content).toMatch(/Salsita.*NOT a separate position/);
    expect(usr.content).toMatch(/must come from the computed TIMELINE block above/);
  });

  test('without a master there is no timeline block — a prompt never states a fact code could not compute', () => {
    const [, u] = buildCareerProfilePrompt('plain CV text', null, NOW);
    expect(u.content).not.toContain('TIMELINE —');
    expect(u.content).not.toContain('computed TIMELINE block');
  });
});

describe('buildAnalysisPrompt with a career profile', () => {
  const profile = {
    country: 'Czech Republic',
    career_arc: 'Twenty years in product.',
    parallel_experience: 'Lectured at Charles University.',
    transferable_skills: 'Discovery, facilitation.',
    base_scenario_tags: ['Senior Portfolio / Independent Consultant'],
    standing_risks: [{ risk: 'Early career from 1993', framing: 'Collapse pre-2011 roles.' }],
    proven_keywords: [{ term: 'UX', proof: 'Head of Experience Design' }],
    timeline: 'TIMELINE — COMPUTED FROM THIS RECORD IN CODE.',
  };
  const withProfile = buildAnalysisPrompt(RECORD, 'Senior PM, Berlin', true, null, 'blueprint', NOW, profile)
    .find((m) => m.role === 'user').content;
  const without = buildAnalysisPrompt(RECORD, 'Senior PM, Berlin', true, null, 'blueprint', NOW)
    .find((m) => m.role === 'user').content;

  test('injects the settled facts, the base scenario and the counted timeline', () => {
    expect(withProfile).toContain('SETTLED FACTS ABOUT THIS CANDIDATE');
    expect(withProfile).toContain('Twenty years in product.');
    expect(withProfile).toContain('Senior Portfolio / Independent Consultant');
    expect(withProfile).toContain('Collapse pre-2011 roles.');
    expect(withProfile).toContain('TIMELINE — COMPUTED FROM THIS RECORD IN CODE.');
    expect(withProfile).toMatch(/NOT yours to re-derive/i);
  });

  // THE SAVING. Every one of these was being re-derived per application to come
  // back with the same answer, and the proof quotes are the longest strings the
  // pass emits.
  test('stops asking for the half that is already settled', () => {
    const schema = withProfile.split('JSON OUTPUT SCHEMA:')[1];
    for (const field of ['career_arc', 'parallel_experience', 'transferable_skills', 'ats_keywords_present']) {
      expect(schema).not.toContain(`"${field}"`);
      expect(without.split('JSON OUTPUT SCHEMA:')[1]).toContain(`"${field}"`);
    }
    expect(schema).toContain('"keywords_for_this_job"');
    expect(withProfile).not.toContain('- analysis.career_arc:');
    expect(without).toContain('- analysis.career_arc:');
  });

  test('shows only the job-relative scenarios, because the base is decided', () => {
    expect(withProfile).not.toContain('- Older Applicant');
    expect(withProfile).toContain('- Career Pivot');
    expect(without).toContain('- Older Applicant');
  });

  test('bars the model from counting tenures itself', () => {
    expect(withProfile).toMatch(/an engagement delivered under a position is never a job/i);
  });

  test('without a profile the prompt is unchanged — no settled-facts block', () => {
    expect(without).not.toContain('SETTLED FACTS');
    expect(without).toContain('- analysis.ats_keywords_present:');
  });
});

// The prompt no longer ASKS for the settled half, so analyzeCvJob must put it
// back before the record leaves the function — everything downstream
// (analysis-brief, cv-generator, cv-validate) reads those exact fields and must
// not be able to tell which path produced them.
vi.mock('../utils/key-manager.js', () => ({
  KeyManager: class { constructor() { this.keys = ['k']; } getNextKey() { return 'k'; } },
}));

describe('analyzeCvJob restores the settled half from the profile', () => {
  const PROFILE = {
    career_arc: 'Twenty years in product.',
    parallel_experience: 'Lectured at Charles University.',
    transferable_skills: 'Discovery, facilitation.',
    base_scenario_tags: ['Senior Portfolio / Independent Consultant'],
    proven_keywords: [
      { term: 'UX', proof: 'Consultant' },
      { term: 'product strategy', proof: 'Nik Page Ltd.' },
    ],
  };

  async function run(modelOutput, profile = PROFILE) {
    vi.doMock('axios', () => ({
      default: {
        post: vi.fn(async () => ({
          data: {
            model: 'gemini-3.5-flash',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            choices: [{ message: { content: JSON.stringify(modelOutput) } }],
          },
        })),
      },
    }));
    vi.resetModules();
    const { analyzeCvJob } = await import('../utils/openai.js');
    const { runWithAiContext } = await import('../utils/ai-meter.js');
    const res = await runWithAiContext({ context: 'test' }, () =>
      analyzeCvJob(RECORD, 'Senior PM, Berlin', 'cv.pdf', null, profile));
    vi.doUnmock('axios');
    return JSON.parse(res.output).analysis;
  }

  test('copies arc, parallel experience and transferable skills onto the result', async () => {
    const out = await run({ analysis: { scenario_tags: [], keywords_for_this_job: ['UX'] } });
    expect(out.career_arc).toBe('Twenty years in product.');
    expect(out.parallel_experience).toBe('Lectured at Charles University.');
    expect(out.transferable_skills).toBe('Discovery, facilitation.');
  });

  test('the settled base scenario leads, the job-relative one follows', async () => {
    const out = await run({ analysis: { scenario_tags: ['Career Pivot'], keywords_for_this_job: ['UX'] } });
    expect(out.scenario_tags).toEqual(['Senior Portfolio / Independent Consultant', 'Career Pivot']);
  });

  test('chosen terms are rejoined with the proof the profile already verified', async () => {
    const out = await run({ analysis: { scenario_tags: [], keywords_for_this_job: ['product strategy'] } });
    expect(out.ats_keywords_present).toEqual([{ term: 'product strategy', proof: 'Nik Page Ltd.' }]);
  });

  test('a term that is not on the proven list is not evidence and is dropped', async () => {
    const out = await run({ analysis: { scenario_tags: [], keywords_for_this_job: ['UX', 'Kubernetes'] } });
    expect(out.ats_keywords_present.map((k) => k.term)).toEqual(['UX']);
  });

  test('no profile, no rewriting — the model output stands as it always did', async () => {
    const out = await run({
      analysis: {
        career_arc: 'model wrote this',
        scenario_tags: ['Career Pivot'],
        ats_keywords_present: [{ term: 'UX', proof: 'Consultant' }],
      },
    }, null);
    expect(out.career_arc).toBe('model wrote this');
    expect(out.scenario_tags).toEqual(['Career Pivot']);
  });
});
