// prompts/headline.test.js
//
// The CV headline is a first-class field: the analysis must ASK for it in both
// prompt paths, and the CV writer must be TOLD to print it (driven by the
// draft, never by a duration). These tests pin the real prompt strings the
// builders emit — they fail the moment the field is dropped from either end.

import { describe, test, expect } from 'vitest';
import { buildAnalysisPrompt } from './analysis.js';
import { buildCvPrompt, buildHeadlinePrompt } from './cv-generator.js';
import { readHeadline, writeHeadline, removeHeadline } from '../utils/cv-headline.js';

const CV = 'Jane Doe — Head of Ops, Acme GmbH, Berlin, 2019-2024. Cut fulfilment cost 18%.';
const JOB = 'Operations Director, Contoso, Munich. Requires SAP and lean manufacturing.';
const TEASER = {
  cv_data: { Name: 'Jane Doe', Country: 'Germany' },
  analysis: { scenario_tags: ['Standard Career Progression'], scan_verdict: 'PASS' },
};

const userOf = (msgs) => msgs.find((m) => m.role === 'user').content;

describe('analysis asks for headline_draft', () => {
  test('teaser-seeded blueprint path specs the field and puts it in the skeleton', () => {
    const p = userOf(buildAnalysisPrompt(CV, JOB, true, TEASER, 'blueprint'));
    expect(p).toContain('generation_framework.cv_blueprint.headline_draft');
    expect(p).toContain('"headline_draft": ""');
    // job-aware wording only when there is an ad to aim at
    expect(p).toContain('Make it job-aware');
    // the honesty rails travel with the field
    expect(p).toContain('never a duration');
  });

  test('blueprint path drops the job-aware clause when there is no job ad', () => {
    const p = userOf(buildAnalysisPrompt(CV, '', false, TEASER, 'blueprint'));
    expect(p).toContain('generation_framework.cv_blueprint.headline_draft');
    expect(p).toContain('"headline_draft": ""');
    expect(p).not.toContain('Make it job-aware');
    expect(p).toContain('With no job ad, name the role the record itself proves');
  });

  test('the review half must NOT ask for it — the blueprint owns it', () => {
    const p = userOf(buildAnalysisPrompt(CV, JOB, true, TEASER, 'review'));
    expect(p).not.toContain('headline_draft');
  });

  test('standalone (no-teaser) path specs the field and puts it in the schema', () => {
    const p = userOf(buildAnalysisPrompt(CV, JOB, true, null));
    expect(p).toContain('generation_framework.cv_blueprint.headline_draft');
    expect(p).toContain('"headline_draft": ""');
  });
});

describe('the CV prompt prints the headline', () => {
  const analysis = {
    generation_framework: { cv_blueprint: { headline_draft: 'Operations Leader | Fulfilment at Scale' } },
  };

  // The writing prompt no longer restates the headline rules — the draft is
  // per-user material and reaches the writer inside the blueprint, and the
  // template keeps the slot (CV_RULES.md, "What the CV IS").
  test('the draft reaches the writer inside the blueprint, with a slot in the template', () => {
    const p = userOf(buildCvPrompt(CV, analysis, 'Confident'));
    expect(p).toContain('Operations Leader | Fulfilment at Scale');
    expect(p).toMatch(/\[Headline — one short line/);
    expect(p).not.toContain('Optional tagline/headline if present in original CV');
  });

  // It survives where it is enforced: the headline-only regeneration prompt,
  // and Layer 6 over the finished document.
  test('the headline may never state a duration', () => {
    const p = userOf(buildHeadlinePrompt(CV, analysis, 'Formal'));
    expect(p).toContain('NEVER a duration');
  });
});

describe('buildHeadlinePrompt (headline-only regeneration)', () => {
  const analysis = {
    generation_framework: { cv_blueprint: { headline_draft: 'Operations Leader | Fulfilment at Scale' } },
  };

  test('carries the draft, the tone, the source CV and the current headline', () => {
    const msgs = buildHeadlinePrompt(CV, analysis, 'Cocky', 'Head of Operations');
    const p = userOf(msgs);
    expect(msgs).toHaveLength(2);
    expect(p).toContain('Operations Leader | Fulfilment at Scale');
    expect(p).toContain('Head of Operations');
    expect(p).toContain('do not repeat it');
    expect(p).toContain('Tone — "Cocky"');
    expect(p).toContain(CV);
    expect(p).toContain('NEVER a duration');
  });

  test('omits the "don\'t repeat" block when the CV has no headline yet', () => {
    const p = userOf(buildHeadlinePrompt(CV, analysis, 'Formal', ''));
    expect(p).not.toContain('do not repeat it');
  });
});

describe('reading and writing the headline in a generated CV', () => {
  const doc = [
    '<center>',
    '',
    '# Jane Doe',
    '**Head of Operations**',
    '+49 123 | jane@doe.de | linkedin.com/in/janedoe',
    '',
    '</center>',
    '',
    '### **Professional Summary**',
    '**Bold text elsewhere must not be touched**',
  ].join('\n');

  test('readHeadline finds the line under the name, not other bold text', () => {
    expect(readHeadline(doc)).toBe('Head of Operations');
  });

  test('writeHeadline replaces it and leaves everything else intact', () => {
    const out = writeHeadline(doc, 'Operations Director | Lean Fulfilment');
    expect(readHeadline(out)).toBe('Operations Director | Lean Fulfilment');
    expect(out).toContain('+49 123 | jane@doe.de | linkedin.com/in/janedoe');
    expect(out).toContain('**Bold text elsewhere must not be touched**');
    expect(out).not.toContain('**Head of Operations**');
    expect(out.split('\n')).toHaveLength(doc.split('\n').length);
  });

  test('writeHeadline inserts one when the CV has none', () => {
    const bare = doc.replace('**Head of Operations**\n', '');
    expect(readHeadline(bare)).toBe('');
    const out = writeHeadline(bare, 'Operations Director');
    expect(readHeadline(out)).toBe('Operations Director');
    expect(out.split('\n')[out.split('\n').indexOf('# Jane Doe') + 1]).toBe('**Operations Director**');
    expect(out).toContain('+49 123 | jane@doe.de | linkedin.com/in/janedoe');
  });

  test('removeHeadline drops the line and is a no-op when there is none', () => {
    const out = removeHeadline(doc);
    expect(readHeadline(out)).toBe('');
    expect(out).not.toContain('**Head of Operations**');
    expect(out).toContain('**Bold text elsewhere must not be touched**');
    expect(removeHeadline(out)).toBe(out);
  });
});
