// prompts/analysis-teaser.test.js
import { describe, it, expect } from 'vitest';
import { buildAnalysisTeaserPrompt } from './analysis-teaser.js';

const userContent = (messages) => messages.find((m) => m.role === 'user').content;

describe('buildAnalysisTeaserPrompt — reads the raw document + layout', () => {
  it('frames the CV as raw extracted text (what a parser receives)', () => {
    const content = userContent(buildAnalysisTeaserPrompt('MY-RAW-CV', '', false));
    expect(content).toContain('MY-RAW-CV');
    expect(content).toMatch(/raw extracted text/i);
  });

  it('injects the layout note when one is supplied', () => {
    const note = 'LAYOUT SIGNAL — 2-column, scramble risk';
    const content = userContent(buildAnalysisTeaserPrompt('cv', '', false, note));
    expect(content).toContain(note);
  });

  it('omits the injected layout block cleanly when there is none (no "undefined")', () => {
    const content = userContent(buildAnalysisTeaserPrompt('cv', '', false, ''));
    expect(content).not.toContain('undefined');
    // The instruction still references a LAYOUT SIGNAL block conditionally, but the
    // actual data block (with its own header) must not be appended when absent.
    expect(content).not.toMatch(/how the FILE ITSELF parses/);
  });

  it('tells the ATS verdict to treat the layout signal as ground truth', () => {
    const content = userContent(buildAnalysisTeaserPrompt('cv', '', false, 'x'));
    expect(content).toMatch(/LAYOUT SIGNAL/);
    expect(content).toMatch(/ats_verdict/);
  });
});
