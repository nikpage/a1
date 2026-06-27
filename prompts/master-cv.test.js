// prompts/master-cv.test.js
import { describe, it, expect } from 'vitest';
import { buildMasterCvPrompt } from './master-cv.js';

const joined = (messages) => messages.map((m) => m.content).join('\n\n');

describe('buildMasterCvPrompt — build mode does not interpret structure', () => {
  const prompt = joined(buildMasterCvPrompt({ mode: 'build', rawInput: 'some CV text' }));

  it('no longer carries a "concurrent" field for the cheap model to set', () => {
    // The build used to ask the model to flag roles concurrent:true — a structural
    // judgment that then drove every downstream pass. It must be gone.
    expect(prompt).not.toMatch(/concurrent/i);
  });

  it('forbids merging overlapping roles into one consultancy', () => {
    expect(prompt).toMatch(/do not infer structure/i);
    expect(prompt).toMatch(/consultancy|engagement|contract/i);
  });

  it('routes overlapping roles to a role_overlap open question instead of resolving them', () => {
    expect(prompt).toContain('role_overlap');
  });
});
