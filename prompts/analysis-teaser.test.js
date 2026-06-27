// prompts/analysis-teaser.test.js
import { describe, it, expect } from 'vitest';
import { buildAnalysisTeaserPrompt } from './analysis-teaser.js';

const userContent = (messages) => messages.find((m) => m.role === 'user').content;

describe('buildAnalysisTeaserPrompt — raw CV for first impressions, graphics from layout', () => {
  it('frames the CV content as the raw CV text in its original order', () => {
    const content = userContent(buildAnalysisTeaserPrompt('MY-RAW-CV-TEXT', '', false));
    expect(content).toContain('MY-RAW-CV-TEXT');
    expect(content).toMatch(/raw CV text/i);
    expect(content).toMatch(/ORIGINAL ORDER/);
  });

  it('forbids reconciling away a first-impression problem the page presents', () => {
    const content = userContent(buildAnalysisTeaserPrompt('rec', '', false));
    expect(content).toMatch(/role overlaps/i);
    expect(content).toMatch(/Do NOT reconcile away/i);
    expect(content).toMatch(/two short most-recent stints sitting ABOVE a longer engagement/i);
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

  it('drives the ATS verdict from the layout signal, since raw text lacks file geometry', () => {
    const content = userContent(buildAnalysisTeaserPrompt('cv', '', false, 'x'));
    expect(content).toMatch(/ats_verdict/);
    expect(content).toMatch(/window into that geometry is the LAYOUT SIGNAL/);
    expect(content).toMatch(/NOT the physical geometry of the file/);
  });
});
