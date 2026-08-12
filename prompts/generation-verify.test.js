// prompts/generation-verify.test.js
//
// The verify prompt is the anti-exaggeration layer, so what it tells the checker
// to leave alone matters as much as what it tells it to catch. These pin the
// rule-5 boundary: fact-shaped degree claims in, strong verbs and evaluative
// words out.

import { describe, it, expect } from 'vitest';
import { buildGenerationVerifyPrompt } from './generation-verify.js';
import { BANNED_PHRASES } from './voice.js';
import { applyGenerationCorrections } from '../utils/openai.js';

const messages = buildGenerationVerifyPrompt({
  docType: 'cv',
  document: 'Single-handedly revolutionised delivery.',
  master: '{"experience":[]}',
});
const system = messages[0].content;
const user = messages[1].content;

describe('rule 5 — unearned intensifier', () => {
  it('names all three flaggable shapes', () => {
    expect(system).toContain('UNEARNED INTENSIFIER');
    expect(system).toContain('TOTALITY or UNIQUENESS');
    expect(system).toContain('SELF-ASSESSED EXPERTISE LEVEL');
    expect(system).toContain('MAGNITUDE THAT OUTRUNS AN AVAILABLE NUMBER');
  });

  it('states it is not a licence to strip adjectives, and only removes the word', () => {
    expect(system).toMatch(/NOT a licence to strip adjectives/);
    expect(system).toMatch(/never a rewrite of the sentence/);
  });

  it('protects strong action verbs from rule 5', () => {
    expect(system).toMatch(/Strong, specific action verbs/);
    expect(system).toContain('spearheaded');
    expect(system).toMatch(/Only flag a verb under rule 3/);
  });

  it('puts evaluative words out of rule 5\'s reach', () => {
    expect(system).toMatch(/Evaluative words with no factual shape/);
    for (const w of ['"strong"', '"significant"', '"successful"', '"effective"']) {
      expect(system).toContain(w);
    }
    expect(system).toMatch(/rule 5 does NOT reach them/);
  });

  it('lets the chosen tone win over the checker', () => {
    expect(system).toMatch(/chosen TONE deliberately calls for/);
    expect(system).toMatch(/never a defect/);
  });
});

describe('the four original categories survive', () => {
  it('still names invented facts, numbers, upgrades and borrowed requirements', () => {
    expect(system).toContain('INVENTED FACT');
    expect(system).toContain('INVENTED NUMBER');
    expect(system).toContain('DERIVED TENURE');
    expect(system).toContain('UPGRADED CLAIM');
    expect(system).toContain('BORROWED REQUIREMENT');
  });

  it('keeps the conservative bias and the verbatim-quote contract', () => {
    expect(system).toMatch(/when in doubt, do NOT flag/i);
    expect(system).toMatch(/MUST appear verbatim in the document/);
  });
});

describe('inputs', () => {
  it('puts the master and the document in front of the checker', () => {
    expect(user).toContain('{"experience":[]}');
    expect(user).toContain('Single-handedly revolutionised delivery.');
  });
});

describe('stock phrasing (rule 6)', () => {
  it('hands the checker the same closed list the writer was given', () => {
    const [system] = buildGenerationVerifyPrompt({ docType: 'cover', document: 'x', master: 'y' });
    expect(system.content).toMatch(/6\. STOCK PHRASE/);
    // Every banned phrase must reach the checker, or it cannot repair it.
    for (const phrase of BANNED_PHRASES) {
      expect(system.content, phrase).toContain(`"${phrase}"`);
    }
    expect(system.content).toMatch(/you must NOT flag anything that is not on it/);
    expect(system.content).toMatch(/NEVER invent a fact to fill the space/);
  });

  it('applies a stock-phrase correction by literal match, like any other', () => {
    const doc = 'Dear Hiring Manager,\n\nI am writing to express my interest in this role. I cut fulfilment cost 18% at Acme.\n\nSincerely,';
    const { content, applied } = applyGenerationCorrections(doc, [
      { quote: 'I am writing to express my interest in this role. ', replacement: '', reason: 'stock phrase' },
    ]);
    expect(content).not.toMatch(/writing to express/);
    expect(content).toContain('I cut fulfilment cost 18% at Acme.');
    expect(applied).toHaveLength(1);
  });
});
