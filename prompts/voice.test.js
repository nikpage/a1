// prompts/voice.test.js
//
// The human-voice rules are shared by the CV and the cover letter, so a rule
// added here must be provably present in BOTH prompts — a rule the cover letter
// never sees is the gap that let "a veteran technology leader" open a shipped
// document while the CV side was already covered.

import { describe, it, expect } from 'vitest';
import { humanVoiceRules } from './voice.js';
import { buildCvPrompt } from './cv-generator.js';
import { buildCoverPrompt } from './cover-letter.js';

const EPITHETS = ['veteran', 'seasoned', 'accomplished', 'industry expert', 'technology leader'];

describe('humanVoiceRules — identity epithets', () => {
  it('bans describing the candidate as a category', () => {
    const t = humanVoiceRules();
    expect(t).toMatch(/Name facts, not identities/);
    for (const word of EPITHETS) expect(t).toContain(word);
  });

  it('states that no tone licenses an empty label', () => {
    expect(humanVoiceRules()).toMatch(/no tone, including cocky, licenses an empty label/i);
  });

  it('reaches the CV prompt', () => {
    const text = JSON.stringify(buildCvPrompt({ cv: 'x', analysis: {}, tone: 'Formal' }));
    expect(text).toMatch(/Name facts, not identities/);
  });

  it('reaches the cover-letter prompt', () => {
    const text = JSON.stringify(buildCoverPrompt({ cv: 'x', analysis: {}, tone: 'Formal' }));
    expect(text).toMatch(/Name facts, not identities/);
  });
});
