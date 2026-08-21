import { describe, it, expect } from 'vitest';
import { buildGenerationVerifyPrompt } from '../prompts/generation-verify';

// A CV generated for a Bitcoin company claimed "experience designing and
// launching customer-facing digital products in regulated financial and
// cryptocurrency domains". The record holds advisory work, a UX practice built
// inside a bank, and QA strategy — no instance of designing and launching a
// customer-facing product. Every rule the checker had compares one claim to one
// role, so a career-level summary sentence, attached to no role, went through:
// each word was individually defensible and nothing contradicted the whole.
describe('rule 6 — a capability the record never instantiates', () => {
  const prompt = () =>
    buildGenerationVerifyPrompt({ docType: 'cv', document: 'x', master: 'y', language: 'en' })[0].content;

  it('asks the checker to name where in the record the capability happened', () => {
    const p = prompt();
    expect(p).toMatch(/UNINSTANTIATED CAPABILITY/);
    expect(p).toMatch(/name the role, client or piece of work in the master where this happened/i);
  });

  it('tells the checker this is separate from rule 3, and why rule 3 misses it', () => {
    const p = prompt();
    expect(p).toMatch(/This is NOT rule 3 and you must check it separately/);
    expect(p).toMatch(/attached to nothing/);
  });

  it('names the job ad as the usual cause', () => {
    expect(prompt()).toMatch(/echoes the ad's language with particular suspicion/);
  });

  it('requires a true version of the sentence rather than deletion', () => {
    const p = prompt();
    expect(p).toMatch(/Do not substitute a different capability/);
    expect(p).toMatch(/do not simply delete the sentence when a true version of it exists/);
  });

  it('closes the two exemptions that used to shelter it', () => {
    const p = prompt();
    // "Reframing real content" protected the wording, and was being read as
    // protecting the claim; "launched" sat on the good-verbs list unconditionally.
    expect(p).toMatch(/not a shelter for rule 6/);
    expect(p).toMatch(/where the record shows no instance of the candidate doing the thing at all/);
  });

  it('keeps the stock-phrase rule reachable as rule 7', () => {
    const p = prompt();
    expect(p).toMatch(/7\. STOCK PHRASE/);
    expect(p).toMatch(/uninstantiated capability/);
  });
});
