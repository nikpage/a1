#!/usr/bin/env node
// scripts/test-generate.mjs
//
// Local prompt-testing harness that reproduces the REAL production generation
// path — read-only, no UI, no token spend, no writes to Supabase. It mirrors,
// call for call:
//   utils/run-generation.js            (source lookup, core, voice profile, calls)
//   netlify/functions/analyse-background.mjs  (one analysis pass, master build)
//   utils/openai.js                    (analyzeCvJob, buildOrMergeMaster,
//                                        generateCV, generateCoverLetter)
// It imports those functions rather than reimplementing them, so a change to
// the real pipeline is automatically exercised here.
//
// Needs GEMINI_API_KEYS (and, for --user mode, Supabase service-role vars) in
// the environment, so run it through Doppler:
//
//   doppler run -- node scripts/test-generate.mjs <cv-file> [options]
//   doppler run -- node scripts/test-generate.mjs --user <user_id-or-email> [options]
//
// Two input modes:
//   <cv-file>            Path to a CV: .pdf, .docx, .txt (required unless --user)
//                         Runs the REAL master build (buildOrMergeMaster) against
//                         this text and generates from the built master, exactly
//                         like production. Falls back to the raw text only if the
//                         build itself throws (same fallback production uses).
//   --user <id|email>    Pulls the REAL stored master_cv, raw cv_data,
//                         voice_profile and candidate_core for this user straight
//                         out of Supabase via the existing utils/database.js
//                         helpers (service-role, read-only). No master is built;
//                         the user's own stored master is the source, exactly as
//                         runGeneration() resolves it via getGenerationSource().
//
// Options:
//   --job <file>         Job ad as .pdf/.docx/.txt (or use --job-text)
//   --job-text "<...>"   Job ad pasted inline
//   --tones <list>        Comma-separated tones, or "all". Default: formal
//                          (valid: formal, friendly, enthusiastic, cocky — only
//                          "formal" is offered in production; the rest are
//                          hidden-but-defined, see prompts/tone.js)
//   --type <cv|cover|both>   What to generate per tone. Default: both
//   --language <auto|en|cs>  Output language, same values as GENERATION_LANGUAGES
//                             in prompts/language.js. Default: auto
//   --core "<text>"       Override candidate_core (defaults to the resolved
//                          user's saved core / the analysis draft, like production)
//   --emphasise "<text>"  Steering: foreground/lead with this
//   --play-down "<text>"  Steering: play down, condense or place late
//   --freeform "<text>"   Steering: free-form instruction
//                          (the three compose into `tweak` via composeTweak(),
//                          exactly as the /me workbench does)
//   --voice <on|off>       Load and use the resolved user's real voice_profile
//                           for the cover letter (on), or pass null (off), like
//                           runGeneration's own try/catch around getVoiceProfile.
//                           Default: on. Only meaningful with --user (file mode
//                           has no stored voice profile, so it is always null).
//   --out <dir>            Output dir. Default: scripts/out/<timestamp>
//   --no-files             Print to console only, don't write files
//
// Examples:
//   doppler run -- node scripts/test-generate.mjs ~/cv.pdf --job ~/job.txt
//   doppler run -- node scripts/test-generate.mjs --user npx10111@gmail.com \
//     --job-text "..." --language cs --emphasise "Kubernetes migration" \
//     --play-down "early retail roles" --voice on
//
// Output: writes analysis.json + <tone>.cv.md / <tone>.cover.md to the out dir,
// and prints a VERIFICATION DIGEST per document: resolved source kind, voice
// profile used?, the composed tweak verbatim, generation_framework.cover_evidence,
// analysis.red_flags/scenario_tags, the Layer-6 validation object (ok/hard/
// warnings), whether the voice fallback rewrite ran, and a cost line for every
// entry in gemini_usages (not just the first) — the cost-logging rule.
//
// This script NEVER writes to Supabase, decrements a generation, or saves a
// generated doc. It calls only read helpers from utils/database.js.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeCvJob,
  buildOrMergeMaster,
  generateCV,
  generateCoverLetter,
} from '../utils/openai.js';
import { withOlderApplicant } from '../prompts/scenarios.js';
import { getMasterCv, getVoiceProfile, getUserByEmail } from '../utils/database.js';
import { enterAiContext, setAiContext } from '../utils/ai-meter.js';
import { getUserById } from '../utils/generation-utils.js';
import { composeTweak } from '../utils/steering.js';
import { GENERATION_LANGUAGES } from '../prompts/language.js';
import extractTextFromPDF from '../utils/pdf-extract.js';
import mammoth from 'mammoth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALID_TONES = ['formal', 'friendly', 'enthusiastic', 'cocky'];

// ---- tiny arg parser ---------------------------------------------------------
function parseArgs(argv) {
  const opts = { tones: 'formal', type: 'both', files: true, language: 'auto', voice: 'on' };
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
  console.log(`  [cost] ${label}: model=${u.model} in=${u.inputTokens} out=${u.outputTokens} think=${u.thinkingTokens} cost=${money(u.costUsd)}`);
  return u.costUsd || 0;
}
function logUsages(label, usages) {
  let cost = 0;
  for (const u of usages || []) cost += logUsage(`${label} / ${u.label || 'call'}`, u);
  return cost;
}

// ---- resolve a user's real stored user_id (accepts a user_id or an email) ----
async function resolveUserId(idOrEmail) {
  if (idOrEmail.includes('@')) {
    const u = await getUserByEmail(idOrEmail);
    if (!u) throw new Error(`No user found for email ${idOrEmail}`);
    return u.user_id;
  }
  return idOrEmail;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.cv && !opts.user)) { usage(); process.exit(opts.help ? 0 : 1); }

  if (!process.env.GEMINI_API_KEYS) {
    console.error('\n✗ GEMINI_API_KEYS is not set. Run via: doppler run -- node scripts/test-generate.mjs ...\n');
    process.exit(1);
  }

  const tones = (opts.tones === 'all' ? VALID_TONES : opts.tones.split(','))
    .map(t => t.trim().toLowerCase()).filter(Boolean);
  const bad = tones.filter(t => !VALID_TONES.includes(t));
  if (bad.length) { console.error(`✗ Invalid tone(s): ${bad.join(', ')}. Valid: ${VALID_TONES.join(', ')}`); process.exit(1); }
  if (!['cv', 'cover', 'both'].includes(opts.type)) { console.error(`✗ --type must be cv | cover | both`); process.exit(1); }
  if (!GENERATION_LANGUAGES[opts.language]) { console.error(`✗ --language must be one of: ${Object.keys(GENERATION_LANGUAGES).join(', ')}`); process.exit(1); }
  if (!['on', 'off'].includes(opts.voice)) { console.error(`✗ --voice must be on | off`); process.exit(1); }

  const tweak = composeTweak({
    emphasise: opts.emphasise || '',
    playDown: opts['play-down'] || '',
    freeform: opts.freeform || '',
  });

  let totalCost = 0;

  // ---- 1. resolve inputs: raw cv_data text, master (if any), voice profile, core
  let rawCvText;
  let master = null;
  let sourceKind; // 'master' | 'raw-fallback' | 'stored-master' | 'stored-raw-fallback'
  let voiceProfile = null;
  let core = opts.core || '';
  let masterUsages = [];

  if (opts.user) {
    const user_id = await resolveUserId(opts.user);
    console.log(`\nUser: ${opts.user} -> user_id ${user_id}`);
    // Attribute this run's calls now that the real user is known. An experiment
    // costs the same money a user's run does and belongs in the same ledger.
    setAiContext({ user_id });

    const user = await getUserById(user_id);
    if (!user) throw new Error(`User ${user_id} not found`);
    if (!core) core = (user.candidate_core && user.candidate_core.trim()) || '';

    // Raw cv_data text — same table/column getGenerationSource's getCV() reads.
    const { supabase } = await import('../utils/database.js');
    const { data, error } = await supabase
      .from('cv_data')
      .select('cv_data')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    rawCvText = data?.[0]?.cv_data || '';
    if (!rawCvText) throw new Error(`No cv_data found for user ${user_id}`);

    master = await getMasterCv(user_id).catch(() => null);
    sourceKind = master ? 'stored-master' : 'stored-raw-fallback';

    if (opts.voice === 'on') {
      try { voiceProfile = await getVoiceProfile(user_id); }
      catch (e) { console.error(`  voice profile load failed: ${e.message}`); }
    }
  } else {
    rawCvText = await extractText(opts.cv);
    console.log(`\nCV: ${opts.cv} (${rawCvText.length} chars)`);

    // Real production build (analyse-background.mjs): build once from the raw
    // text, fall back to raw text only if the build itself throws.
    console.log('  building master CV (buildOrMergeMaster)...');
    try {
      const built = await buildOrMergeMaster(rawCvText);
      master = built.output;
      masterUsages = built.usages;
      totalCost += logUsages('master build', masterUsages);
      sourceKind = 'master';
    } catch (e) {
      console.error(`  ✗ master build failed, falling back to raw text (matches production): ${e.message}`);
      master = null;
      sourceKind = 'raw-fallback';
    }
    // File mode has no persisted account, so there is no stored voice profile
    // to load — matches an anonymous/never-extracted user's real generation.
    voiceProfile = null;
  }

  const generationSource = master ? JSON.stringify(master) : rawCvText;

  let jobText = '';
  if (opts['job-text']) jobText = opts['job-text'].trim();
  else if (opts.job) jobText = await extractText(opts.job);
  console.log(`Job: ${opts.job || (opts['job-text'] ? '<inline>' : '(none)')}${jobText ? ` (${jobText.length} chars)` : ''}`);
  console.log(`Tones: ${tones.join(', ')} | Type: ${opts.type} | Language: ${opts.language}`);
  console.log(`Source: ${sourceKind}${master ? '' : ' (no master — analysis/generation reading raw text)'}`);
  if (tweak) console.log(`Tweak:\n${tweak.split('\n').map(l => `  ${l}`).join('\n')}`);
  console.log(`Voice profile: ${voiceProfile ? 'found, will be used for cover letters' : 'none / disabled'}`);

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

  // ---- 2. analysis: ONE pass over the master, exactly as the worker runs it --
  console.log('\n═══ ANALYSIS ═══');
  console.log('  analysis (master)...');
  const analysisRes = await analyzeCvJob(generationSource, jobText, path.basename(opts.cv || 'master.json'));
  const analysis = JSON.parse(analysisRes.output);
  totalCost += logUsages('analysis', analysisRes.gemini_usages || [analysisRes.gemini_usage]);

  // Older Applicant is computed in code from the master's dates, same as
  // analyse-background.mjs — not left to the model's 1-2 tag slots.
  if (master && analysis.analysis) {
    analysis.analysis.scenario_tags = withOlderApplicant(analysis.analysis.scenario_tags, master);
  }

  write('analysis.json', JSON.stringify(analysis, null, 2));

  const a = analysis.analysis || {};
  console.log(`  scenario_tags : ${JSON.stringify(a.scenario_tags)}`);
  console.log(`  scores        : overall ${a.overall_score} | ats ${a.ats_score}`);
  console.log(`  red_flags     : ${JSON.stringify(a.red_flags)}`);

  // ---- 3. generation per tone, exactly through generateCV/generateCoverLetter
  for (const tone of tones) {
    const toneCased = tone.charAt(0).toUpperCase() + tone.slice(1);
    console.log(`\n═══ TONE: ${toneCased.toUpperCase()} ═══`);

    if (opts.type === 'cv' || opts.type === 'both') {
      const r = await generateCV({ cv: generationSource, analysis, tone: toneCased, tweak, core, language: opts.language });
      totalCost += logUsages(`cv/${tone}`, r.gemini_usages);
      write(`${tone}.cv.md`, r.content);
      console.log(`\n----- CV (${tone}) -----\n${r.content}\n`);
      printDigest('CV', r, { sourceKind, voiceProfile: null, tweak, analysis });
    }

    if (opts.type === 'cover' || opts.type === 'both') {
      const r = await generateCoverLetter({ cv: generationSource, analysis, tone: toneCased, tweak, core, language: opts.language, voiceProfile });
      totalCost += logUsages(`cover/${tone}`, r.gemini_usages);
      write(`${tone}.cover.md`, r.content);
      console.log(`\n----- COVER LETTER (${tone}) -----\n${r.content}\n`);
      printDigest('COVER LETTER', r, { sourceKind, voiceProfile, tweak, analysis });
    }
  }

  console.log(`\n═══ DONE — total cost ${money(totalCost)} ═══`);
  if (outDir) console.log(`Outputs in: ${outDir}`);
}

// The point of the whole exercise: prove what actually reached the model and
// what the deterministic layers found, per generated document.
function printDigest(label, result, { sourceKind, voiceProfile, tweak, analysis }) {
  const ce = analysis.generation_framework?.cover_evidence || {};
  console.log(`  --- VERIFICATION DIGEST (${label}) ---`);
  console.log(`  source              : ${sourceKind}`);
  console.log(`  voice profile used  : ${voiceProfile ? 'yes' : 'no'}`);
  console.log(`  tweak (verbatim)    : ${tweak ? JSON.stringify(tweak) : '(none)'}`);
  console.log(`  cover_evidence      : ${JSON.stringify(ce, null, 2)}`);
  console.log(`  red_flags           : ${JSON.stringify(analysis.analysis?.red_flags)}`);
  console.log(`  scenario_tags       : ${JSON.stringify(analysis.analysis?.scenario_tags)}`);
  console.log(`  validation.ok       : ${result.validation?.ok}`);
  console.log(`  validation.hard     : ${JSON.stringify(result.validation?.hard || [])}`);
  console.log(`  validation.warnings : ${JSON.stringify(result.validation?.warnings || [])}`);
  console.log(`  voice fallback ran  : ${result.voice_fixes && result.voice_fixes.length ? `yes (${result.voice_fixes.length} fix(es))` : 'no'}`);
  for (const u of result.gemini_usages || []) {
    logUsage(u.label || 'call', u);
  }
}

// EXPERIMENTS ARE SPEND. Every call this script makes lands in `transactions`
// tagged context='script:test-generate' and counts against the daily budget —
// which is what stops a model bake-off from quietly running up a bill.
enterAiContext({ context: 'script:test-generate' });

main().catch((err) => {
  console.error('\n✗ Error:', err.response?.data || err.message || err);
  process.exit(1);
});
