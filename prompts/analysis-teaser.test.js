// prompts/analysis-teaser.test.js
import { describe, it, expect } from 'vitest';
import { buildAnalysisTeaserPrompt } from './analysis-teaser.js';

const userContent = (messages) => messages.find((m) => m.role === 'user').content;

describe('buildAnalysisTeaserPrompt — data from the record, graphics from layout', () => {
  it('frames the CV content as the faithful structured candidate record', () => {
    const content = userContent(buildAnalysisTeaserPrompt('MY-RECORD-JSON', '', false));
    expect(content).toContain('MY-RECORD-JSON');
    expect(content).toMatch(/CANDIDATE RECORD/);
    expect(content).toMatch(/faithful structured facts/i);
  });

  it('tells the model that overlapping roles are a real signal, not a merge', () => {
    const content = userContent(buildAnalysisTeaserPrompt('rec', '', false));
    expect(content).toMatch(/role overlaps/i);
    expect(content).toMatch(/not a merge/i);
  });

  it('injects the layout note when one is supplied', () => {
    const note = 'LAYOUT SIGNAL — 2-column, scramble risk';
    const content = userContent(buildAnalysisTeaserPrompt('cv', '', false, note));
    expect(content).toContain(note);
  });

  it('omits the layout block cleanly when there is none (no "undefined")', () => {
    const content = userContent(buildAnalysisTeaserPrompt('cv', '', false, ''));
    expect(content).not.toContain('undefined');
  });

  it('drives the ATS verdict from the layout signal, NOT the structured record', () => {
    const content = userContent(buildAnalysisTeaserPrompt('cv', '', false, 'x'));
    expect(content).toMatch(/ats_verdict/);
    expect(content).toMatch(/ONLY window into the real file is the LAYOUT SIGNAL/);
    expect(content).toMatch(/do NOT infer parse problems from it/);
  });
});
