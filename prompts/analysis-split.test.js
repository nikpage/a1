// prompts/analysis-split.test.js
//
// The deep (teaser-seeded) pass is split into two calls so neither half shares
// one output budget with the other. These tests pin that the split is REAL:
// each mode asks for its own fields and explicitly refuses the other's, and the
// two halves recombine into the complete schema every consumer expects.

import { describe, test, expect } from 'vitest';
import { buildAnalysisPrompt } from './analysis.js';
import { mergeTeaserAndDelta } from '../utils/openai.js';

const CV = 'Jane Doe — Head of Ops, Acme GmbH, Berlin, 2019-2024. Cut fulfilment cost 18%.';
const JOB = 'Operations Director, Contoso, Munich. Requires SAP, lean manufacturing, team leadership of 20+.';
const TEASER = {
  cv_data: { Name: 'Jane Doe', Country: 'Germany' },
  analysis: {
    scenario_tags: ['Standard Career Progression'],
    hr_first_seconds: 'Reads as an ops leader.',
    scan_verdict: 'PASS',
    ats_verdict: 'PASS',
  },
};

const userOf = (mode) =>
  buildAnalysisPrompt(CV, JOB, true, TEASER, mode).find((m) => m.role === 'user').content;

describe('deep pass is split into blueprint + review', () => {
  test('blueprint asks for the generation fields and refuses the review fields', () => {
    const p = userOf('blueprint');

    // owns the fields the CV/cover generators actually execute
    expect(p).toContain('"generation_framework"');
    expect(p).toContain('"summary_draft"');
    expect(p).toContain('"skills_to_highlight"');
    expect(p).toContain('"job_selection"');
    expect(p).toContain('"candidate_core"');
    expect(p).toContain('"jobs_extracted"');
    expect(p).toContain('"positioning_strategy"');
    expect(p).toContain('"red_flags"');
    expect(p).toContain('"ats_keywords_present"');
    expect(p).toContain('"job_extraction"');

    // must NOT spend budget on the on-screen read-out
    expect(p).not.toContain('"overall_score"');
    expect(p).not.toContain('"overall_commentary"');
    expect(p).not.toContain('"quick_wins"');
    expect(p).not.toContain('"action_items"');
    expect(p).not.toContain('"final_thought"');
    expect(p).toMatch(/do NOT emit scores, commentary, quick_wins or action_items/);
  });

  test('review asks for the on-screen fields and refuses the blueprint', () => {
    const p = userOf('review');

    expect(p).toContain('"overall_score"');
    expect(p).toContain('"ats_score"');
    expect(p).toContain('"overall_commentary"');
    expect(p).toContain('"quick_wins"');
    expect(p).toContain('"action_items"');
    expect(p).toContain('"cv_format_analysis"');
    expect(p).toContain('"cultural_fit"');
    expect(p).toContain('"final_thought"');

    expect(p).not.toContain('"generation_framework"');
    expect(p).not.toContain('"summary_draft"');
    expect(p).not.toContain('"skills_to_highlight"');
    expect(p).not.toContain('"jobs_extracted"');
    expect(p).not.toContain('"candidate_core"');
    expect(p).not.toContain('"job_extraction"');
    expect(p).toMatch(/do NOT emit generation_framework, jobs_extracted, candidate_core or job_extraction/);
  });

  test('neither half re-emits the fields carried from the teaser', () => {
    for (const mode of ['blueprint', 'review']) {
      const p = userOf(mode);
      expect(p).toMatch(/DO NOT RECOMPUTE OR RE-EMIT/);
      expect(p).toContain('analysis.scenario_tags');
      // The teaser object is quoted earlier in the prompt as established input,
      // so only the requested OUTPUT SHAPE may be free of its fields.
      const schema = p.slice(p.indexOf('OUTPUT EXACTLY THIS SHAPE'));
      expect(schema).not.toContain('"scenario_tags"');
      expect(schema).not.toContain('"hr_first_seconds"');
      expect(schema).not.toContain('"scan_verdict"');
    }
  });

  test('both halves still carry the governing rules (scenario handling + no-fabrication)', () => {
    for (const mode of ['blueprint', 'review']) {
      const msgs = buildAnalysisPrompt(CV, JOB, true, TEASER, mode);
      expect(msgs.find((m) => m.role === 'system').content).toContain('REFRAME vs ADD');
      expect(msgs.find((m) => m.role === 'user').content).toContain('SCENARIO HANDLING');
    }
  });

  test('merging teaser + both halves yields one complete analysis with no half clobbering the other', () => {
    const blueprint = {
      candidate_core: 'Ops leader.',
      jobs_extracted: [{ title: 'Head of Ops', company: 'Acme GmbH' }],
      analysis: { career_arc: 'Ops through-line.', red_flags: ['none'], ats_keywords_present: 'lean' },
      job_match: { positioning_strategy: 'Lead with cost reduction.', career_scenario: 'Standard Career Progression' },
      generation_framework: { cv_blueprint: { summary_draft: 'Cut fulfilment cost 18%.' }, target_cover_words: 275 },
    };
    const review = {
      summary: 'Strong ops record.',
      analysis: { overall_score: '7', quick_wins: ['Move the 18% metric to line one'] },
      final_thought: 'Score 7.',
    };

    const merged = mergeTeaserAndDelta(TEASER, mergeTeaserAndDelta(blueprint, review));

    // blueprint half survived
    expect(merged.candidate_core).toBe('Ops leader.');
    expect(merged.generation_framework.cv_blueprint.summary_draft).toBe('Cut fulfilment cost 18%.');
    expect(merged.job_match.positioning_strategy).toBe('Lead with cost reduction.');
    expect(merged.analysis.career_arc).toBe('Ops through-line.');
    // review half survived
    expect(merged.analysis.overall_score).toBe('7');
    expect(merged.analysis.quick_wins).toEqual(['Move the 18% metric to line one']);
    expect(merged.final_thought).toBe('Score 7.');
    // teaser fields survived both merges
    expect(merged.analysis.scenario_tags).toEqual(['Standard Career Progression']);
    expect(merged.analysis.hr_first_seconds).toBe('Reads as an ops leader.');
    expect(merged.cv_data.Name).toBe('Jane Doe');
  });
});
