// __tests__/ai-spend-containment.test.js
//
// EVERY GEMINI CALL IS ACCOUNTED FOR. That guarantee rests on one structural
// fact: `callGemini` in utils/openai.js is the only way to reach the API, and it
// meters and budget-checks whatever passes through it. These tests defend that
// fact against the two ways it can quietly stop being true:
//
//   1. someone (or some agent) adds a SECOND way to reach Gemini — a raw
//      axios/fetch POST to the endpoint, or a Google GenAI SDK — which the meter
//      never sees;
//   2. a script imports utils/openai.js and never declares an AI cost context,
//      so its spend belongs to nobody.
//
// Neither is caught by any behavioural test, because the code works fine — it
// just spends invisibly. So they are caught here, by reading the repo.

import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', 'coverage', '.netlify']);
const CODE_EXT = new Set(['.js', '.mjs', '.jsx', '.ts', '.tsx']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.netlify') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (CODE_EXT.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const rel = (f) => path.relative(ROOT, f);
const ALL_CODE = walk(ROOT).map((f) => ({ file: rel(f), text: fs.readFileSync(f, 'utf8') }));

describe('there is exactly one way to reach Gemini', () => {
  // The meter lives inside callGemini. A second door — raw HTTP to the
  // endpoint, or an SDK that opens its own connection — spends money the ledger
  // and the daily ceiling never see. If a new door is genuinely needed, it must
  // route through callGemini or carry its own metering, and this list is where
  // that decision gets recorded.
  const ALLOWED = new Set(['utils/openai.js']);

  test('no file but utils/openai.js names the Gemini API endpoint', () => {
    const offenders = ALL_CODE
      .filter(({ file }) => !ALLOWED.has(file) && !file.startsWith('__tests__/'))
      .filter(({ text }) => /generativelanguage\.googleapis\.com/.test(text))
      .map(({ file }) => file);

    expect(offenders, `these bypass the cost meter: ${offenders.join(', ')}`).toEqual([]);
  });

  test('no Google GenAI SDK is imported anywhere', () => {
    const offenders = ALL_CODE
      .filter(({ file }) => !file.startsWith('__tests__/'))
      .filter(({ text }) => /(from|require\()\s*['"]@google\/(genai|generative-ai)['"]/.test(text))
      .map(({ file }) => file);

    expect(offenders, `an SDK call never reaches the meter: ${offenders.join(', ')}`).toEqual([]);
  });

  test('the SDK is not even a dependency', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps).filter((d) => d.startsWith('@google/'))).toEqual([]);
  });
});

describe('every script that can spend money declares who is spending it', () => {
  // A script is the easiest place to forget attribution and the easiest place
  // to burn money fast (a model bake-off is dozens of calls). callGemini now
  // refuses an unattributed call outright, so a forgetful script crashes rather
  // than spending — this test makes it fail in CI instead of at 2am.
  const scriptDir = path.join(ROOT, 'scripts');
  const scripts = fs
    .readdirSync(scriptDir)
    .filter((f) => CODE_EXT.has(path.extname(f)))
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(scriptDir, f), 'utf8') }));

  test('there is at least one script to check', () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  test.each(scripts.map((s) => s.name))('%s: imports utils/openai.js ⇒ enters an AI cost context', (name) => {
    const { text } = scripts.find((s) => s.name === name);
    const spends = /from\s+['"]\.\.\/utils\/openai\.js['"]/.test(text);
    if (!spends) return;

    expect(
      /enterAiContext\s*\(|runWithAiContext\s*\(/.test(text),
      `scripts/${name} makes Gemini calls but never declares an AI cost context — ` +
      `add enterAiContext({ context: 'script:${name.replace(/\.[^.]+$/, '')}' })`
    ).toBe(true);
  });
});
