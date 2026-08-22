#!/usr/bin/env node
// scripts/golden-check.mjs
//
// Every check here is a defect found by READING a real generated document. It
// fails now and passes when the defect is actually fixed, so "is it fixed?"
// stops being a person reading pages and becomes a command.
//
// Text is never matched exactly. A generated document never repeats word for
// word, so an exact diff would fail on every run and prove nothing. What is
// pinned is what the document must SAY: the crypto engagements by name, the
// employers a screener recognises, no capability the record cannot instantiate.
//
// Inputs are FROZEN (scripts/fixtures/golden/): a snapshot of the master and
// the ad, not the live database, so a run today and a run next week see the
// same thing and any difference in the output is the code's doing.
//
//   node scripts/golden-check.mjs                 # both documents
//   node scripts/golden-check.mjs --type cv       # one of them
//   node scripts/golden-check.mjs --check-only <dir>   # re-check saved output, no spend
//
// A full run costs one analysis plus one generation per document.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'golden');
const spec = JSON.parse(readFileSync(join(FIX, 'expectations.json'), 'utf8'));

// Diacritic-folded, case-flattened, whitespace-collapsed: a document written in
// another language's case system must not slip a check on its ending, and a
// line break must not hide a phrase.
const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

function judge(document, checks) {
  const doc = fold(document);
  const results = [];
  for (const c of checks) {
    const missing = (c.require_all || []).filter((t) => !doc.includes(fold(t)));
    const anyHit = !c.require_any || c.require_any.some((t) => doc.includes(fold(t)));
    const banned = (c.forbid_any || []).filter((t) => doc.includes(fold(t)));
    const ok = missing.length === 0 && anyHit && banned.length === 0;
    results.push({ id: c.id, ok, missing, anyHit, banned, why: c.why });
  }
  return results;
}

function report(label, results) {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${label}: ${pass}/${results.length} checks pass`);
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id}`);
    if (r.ok) continue;
    if (r.missing.length) console.log(`        missing: ${r.missing.join(', ')}`);
    if (!r.anyHit) console.log(`        none of the expected terms appeared`);
    if (r.banned.length) console.log(`        must not appear: ${r.banned.join(', ')}`);
    console.log(`        why: ${r.why}`);
  }
  return results.every((r) => r.ok);
}

const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};

// Re-check documents already on disk. No AI call, no spend — use it after a
// paid run to re-read the same output against changed expectations.
const checkOnly = argVal('--check-only');
if (checkOnly) {
  let allOk = true;
  for (const f of readdirSync(checkOnly).filter((f) => f.endsWith('.md'))) {
    const type = f.includes('cover') ? 'cover' : 'cv';
    const text = readFileSync(join(checkOnly, f), 'utf8');
    allOk = report(`${f} (${type})`, judge(text, spec[type])) && allOk;
  }
  process.exit(allOk ? 0 : 1);
}

const wanted = argVal('--type') || 'both';
const types = wanted === 'both' ? ['cv', 'cover'] : [wanted];

const { enterAiContext } = await import('../utils/ai-meter.js');
enterAiContext({ context: 'script:golden-check', detail: 'regression run over frozen inputs' });

const { analyzeCvJob, generateCV, generateCoverLetter } = await import('../utils/openai.js');

const master = JSON.parse(readFileSync(join(FIX, spec.master), 'utf8'));
const jobText = readFileSync(join(FIX, spec.ad), 'utf8');

const outDir = join(HERE, 'out', `golden-${new Date().toISOString().replace(/[:.]/g, '-')}`);
mkdirSync(outDir, { recursive: true });

const usages = [];
const money = (u) => usages.push(...(Array.isArray(u) ? u : u ? [u] : []));

console.log('Analysing the frozen record against the frozen ad...');
const analysisResult = await analyzeCvJob(JSON.stringify(master), jobText, null);
// analyzeCvJob returns `output` as a JSON STRING — the worker parses it
// (utils/run-generation.js) and so must this harness. Handing the string
// straight on left every analysis-driven check in Layer 6 silently blind.
const raw = analysisResult.output ?? analysisResult;
const analysis = typeof raw === 'string' ? JSON.parse(raw) : raw;
// Older Applicant is computed in code from the master's dates, exactly as
// analyse-background.mjs does it — not left to the model's two tag slots.
const { withOlderApplicant } = await import('../prompts/scenarios.js');
if (analysis?.analysis) {
  analysis.analysis.scenario_tags = withOlderApplicant(analysis.analysis.scenario_tags, master);
}
money(analysisResult.usages ?? analysisResult.gemini_usage);
writeFileSync(join(outDir, 'analysis.json'), JSON.stringify(analysis, null, 2));

let allOk = true;
for (const type of types) {
  console.log(`Generating the ${type}...`);
  const gen =
    type === 'cv'
      ? await generateCV({ analysis, cv: JSON.stringify(master), tone: 'formal', language: 'en' })
      : await generateCoverLetter({ analysis, cv: JSON.stringify(master), tone: 'formal', language: 'en' });
  const doc = gen.content ?? gen.output ?? gen.document ?? gen;
  money(gen.usages ?? gen.gemini_usage);
  const file = join(outDir, `${type}.md`);
  writeFileSync(file, typeof doc === 'string' ? doc : JSON.stringify(doc, null, 2));
  allOk = report(`${type}`, judge(typeof doc === 'string' ? doc : '', spec[type])) && allOk;
}

const cost = usages.reduce((t, u) => t + (u?.costUsd || 0), 0);
console.log(`\nOutput written to ${outDir}`);
console.log(`Cost: $${cost.toFixed(4)} across ${usages.length} calls`);
console.log(allOk ? '\nAll checks pass.' : '\nChecks failed — the defects above are still present.');
process.exit(allOk ? 0 : 1);
