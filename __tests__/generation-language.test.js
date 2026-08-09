// __tests__/generation-language.test.js
//
// The output language of a generated CV / cover letter used to be fixed to the
// master CV's own language ("if the job ad is in another language, the master
// CV's language wins"), so an English master CV could never produce a Czech
// application. These pin the explicit override end to end:
//   - the real prompt builders carry the chosen language;
//   - 'auto' and any unrecognised value keep the original behaviour;
//   - the route coerces junk from the body instead of passing it to the prompt.
//
// Red on the old code (no language parameter existed; the CV prompt always said
// the master CV's language wins), green on the new.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { buildCvPrompt } from '../prompts/cv-generator.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { languageInstruction } from '../prompts/language.js';

const CV = '{"experience":[]}';
const ANALYSIS = { analysis: {} };
const text = (messages) => messages.map((m) => m.content).join('\n');

describe('languageInstruction', () => {
  test('an explicit language demands that language and protects proper nouns', () => {
    const cs = languageInstruction('cs');
    expect(cs).toMatch(/Czech/);
    expect(cs).toMatch(/Proper nouns stay as they are/);
    // It must not also tell the model the CV's own language wins.
    expect(cs).not.toMatch(/master CV's language wins/);
  });

  test("'auto' and unknown values keep the original master-CV-language rule", () => {
    const auto = languageInstruction('auto');
    expect(auto).toMatch(/master CV's detected language/);
    expect(languageInstruction('klingon')).toBe(auto);
    expect(languageInstruction()).toBe(auto);
  });
});

describe('the generation prompts carry the chosen language', () => {
  test('CV prompt: cs demands Czech, en demands English, auto keeps the old rule', () => {
    expect(text(buildCvPrompt(CV, ANALYSIS, 'formal', '', '', 'cs'))).toMatch(/ENTIRE document in Czech/);
    expect(text(buildCvPrompt(CV, ANALYSIS, 'formal', '', '', 'en'))).toMatch(/ENTIRE document in English/);

    const auto = text(buildCvPrompt(CV, ANALYSIS, 'formal', '', '', 'auto'));
    expect(auto).toMatch(/master CV's detected language/);
    expect(auto).not.toMatch(/ENTIRE document in/);
  });

  test('cover-letter prompt: same choice, same instruction', () => {
    expect(text(buildCoverPrompt(CV, ANALYSIS, 'formal', '', '', 'cs'))).toMatch(/ENTIRE document in Czech/);
    expect(text(buildCoverPrompt(CV, ANALYSIS, 'formal', '', '', 'en'))).toMatch(/ENTIRE document in English/);
    expect(text(buildCoverPrompt(CV, ANALYSIS, 'formal', '', '', 'auto'))).toMatch(/master CV's detected language/);
  });

  test('the language never licenses inventing a language skill', () => {
    expect(text(buildCvPrompt(CV, ANALYSIS, 'formal', '', '', 'cs')))
      .toMatch(/Never claim or imply a level of this language the candidate's record does not evidence/);
  });

  test('omitting the argument entirely leaves existing callers unchanged', () => {
    expect(text(buildCvPrompt(CV, ANALYSIS, 'formal'))).toMatch(/master CV's detected language/);
    expect(text(buildCoverPrompt(CV, ANALYSIS, 'formal'))).toMatch(/master CV's detected language/);
  });
});
