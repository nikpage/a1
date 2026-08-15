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

  // The epithet ban applies to the CV, NOT the letter (2026-08-15). "As an
  // experienced product leader" opened the letter Nik judged far better than
  // anything the pipeline produced; banning it cost more than it saved. The
  // letter keeps the BANNED PHRASE list, which is about empty boilerplate
  // rather than about naming a category.
  it('reaches the CV prompt but not the letter, which keeps only the banned-phrase list', () => {
    const cv = JSON.stringify(buildCvPrompt('MASTER', { analysis: {} }, 'Formal'));
    expect(cv).toMatch(/Name facts, not identities/);

    const cover = JSON.stringify(buildCoverPrompt('MASTER', { analysis: {} }, 'Formal'));
    expect(cover).not.toMatch(/Name facts, not identities/);
    expect(cover).toMatch(/BANNED PHRASES/);
    expect(cover).toMatch(/proven track record/);
  });
});
