#!/usr/bin/env node
// scripts/test-generate.mjs
//
// Local prompt-testing harness. Runs the REAL production code path
// (utils/openai.js -> prompts/*) against a CV file + optional job ad, with no
// UI, no Supabase, no auth, no token spend — so you can iterate on the prompts
// and eyeball the output (AI-tells, cliché clustering, bullet variety, tone).
//
// Needs GEMINI_API_KEYS in the environment, so run it through Doppler:
//
//   doppler run -- node scripts/test-generate.mjs <cv-file> [options]
//
// Arguments:
//   <cv-file>            Path to the CV: .pdf, .docx, or .txt  (required)
//
// Options:
//   --job <file>        Job ad as .pdf/.docx/.txt (or use --job-text)
//   --job-text "<...>"  Job ad pasted inline
//   --tones <list>      Comma-separated tones, or "all". Default: formal
//                       (valid: formal, friendly, enthusiastic, cocky)
//   --type <cv|cover|both>   What to generate per tone. Default: both
//   --out <dir>         Output dir. Default: scripts/out/<timestamp>
//   --no-files          Print to console only, don't write files
//
// Examples:
//   doppler run -- node scripts/test-generate.mjs ~/cv.pdf --job ~/job.txt
//   doppler run -- node scripts/test-generate.mjs ~/cv.pdf --tones all --type cover
//
// Output: writes analysis.json + <tone>.cv.md / <tone>.cover.md to the out dir,
// and prints a digest (scenario tags, scores, the generated docs, total cost).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeCvJob, generateCV, generateCoverLetter } from '../utils/openai.js';
import extractTextFromPDF from '../utils/pdf-extract.js';
import mammoth from 'mammoth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALID_TONES = ['formal', 'friendly', 'enthusiastic', 'cocky'];

// ---- tiny arg parser ---------------------------------------------------------
function parseArgs(argv) {
  const opts = { tones: 'formal', type: 'both', files: true };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-files') opts.files = false;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--')) opts[a.slice(2)] = argv[++i];
    else positional.push(a);
  }
  opts.cv = positional[0];
  return opts;
}

function usage() {
  const header = [];
  for (const line of fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')) {
    if (line.startsWith('#!')) continue;        // skip shebang
    if (!line.startsWith('//')) break;          // stop at first non-comment line (end of header block)
    header.push(line.replace(/^\/\/ ?/, ''));
  }
  console.log(header.join('\n'));
}

async function extractText(file) {
  const ext = path.extname(file).toLowerCase();
  const buffer = fs.readFileSync(file);
  if (ext === '.pdf') return (await extractTextFromPDF(buffer)).trim();
  if (ext === '.docx') return (await mammoth.extractRawText({ buffer })).text.trim();
  if (ext === '.txt' || ext === '.md') return buffer.toString('utf8').trim();
  throw new Error(`Unsupported file type: ${ext} (use .pdf, .docx, .txt)`);
}

const money = (n) => `$${(n || 0).toFixed(5)}`;
function logUsage(label, u) {
  if (!u) return 0;
  console.log(`  [cost] ${label}: ${u.totalTokens} tok (in ${u.inputTokens} / out ${u.outputTokens} / think ${u.thinkingTokens}) = ${money(u.costUsd)}`);
  return u.costUsd || 0;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.cv) { usage(); process.exit(opts.help ? 0 : 1); }

  if (!process.env.GEMINI_API_KEYS) {
    console.error('\n✗ GEMINI_API_KEYS is not set. Run via: doppler run -- node scripts/test-generate.mjs ...\n');
    process.exit(1);
  }

  const tones = (opts.tones === 'all' ? VALID_TONES : opts.tones.split(','))
    .map(t => t.trim().toLowerCase()).filter(Boolean);
  const bad = tones.filter(t => !VALID_TONES.includes(t));
  if (bad.length) { console.error(`✗ Invalid tone(s): ${bad.join(', ')}. Valid: ${VALID_TONES.join(', ')}`); process.exit(1); }
  if (!['cv', 'cover', 'both'].includes(opts.type)) { console.error(`✗ --type must be cv | cover | both`); process.exit(1); }

  // ---- inputs ----
  const cvText = await extractText(opts.cv);
  let jobText = '';
  if (opts['job-text']) jobText = opts['job-text'].trim();
  else if (opts.job) jobText = await extractText(opts.job);
  console.log(`\nCV: ${opts.cv} (${cvText.length} chars)`);
  console.log(`Job: ${opts.job || (opts['job-text'] ? '<inline>' : '(none)')}${jobText ? ` (${jobText.length} chars)` : ''}`);
  console.log(`Tones: ${tones.join(', ')} | Type: ${opts.type}\n`);

  // ---- output dir ----
  let outDir = null;
  if (opts.files) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    outDir = opts.out || path.join(__dirname, 'out', stamp);
    fs.mkdirSync(outDir, { recursive: true });
  }
  const write = (name, content) => {
    if (!outDir) return;
    fs.writeFileSync(path.join(outDir, name), content);
    console.log(`  → wrote ${path.join(outDir, name)}`);
  };

  let totalCost = 0;

  // ---- 1. analysis (drives everything downstream) ----
  console.log('═══ ANALYSIS ═══');
  const aRes = await analyzeCvJob(cvText, jobText, path.basename(opts.cv));
  totalCost += logUsage('analysis', aRes.gemini_usage);
  const analysis = JSON.parse(aRes.output);
  write('analysis.json', JSON.stringify(analysis, null, 2));

  const a = analysis.analysis || {};
  console.log(`  scenario_tags : ${JSON.stringify(a.scenario_tags)}`);
  console.log(`  scores        : overall ${a.overall_score} | ats ${a.ats_score}`);
  console.log(`  red_flags     : ${JSON.stringify(a.red_flags)}`);
  console.log(`  summary_draft : ${analysis.generation_framework?.cv_blueprint?.summary_draft || '(none)'}`);

  // ---- 2. generation per tone ----
  for (const tone of tones) {
    console.log(`\n═══ TONE: ${tone.toUpperCase()} ═══`);

    if (opts.type === 'cv' || opts.type === 'both') {
      const r = await generateCV({ cv: cvText, analysis, tone });
      totalCost += logUsage(`cv/${tone}`, r.gemini_usage);
      write(`${tone}.cv.md`, r.content);
      console.log(`\n----- CV (${tone}) -----\n${r.content}\n`);
    }

    if (opts.type === 'cover' || opts.type === 'both') {
      const r = await generateCoverLetter({ cv: cvText, analysis, tone });
      totalCost += logUsage(`cover/${tone}`, r.gemini_usage);
      write(`${tone}.cover.md`, r.content);
      console.log(`\n----- COVER LETTER (${tone}) -----\n${r.content}\n`);
    }
  }

  console.log(`\n═══ DONE — total cost ${money(totalCost)} ═══`);
  if (outDir) console.log(`Outputs in: ${outDir}`);
}

main().catch((err) => {
  console.error('\n✗ Error:', err.response?.data || err.message || err);
  process.exit(1);
});
