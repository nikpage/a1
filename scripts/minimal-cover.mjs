#!/usr/bin/env node
// scripts/minimal-cover.mjs
//
// THE CONTROL EXPERIMENT. Nik's own four-line prompt — master record + job ad +
// "highlight what aligns, professional tone, 150-250 words" — run against the
// same record, the same ad and the same model as the production pipeline, so
// the 13k-token rule stack can be compared with the thing it is supposed to
// beat. It writes the letter and stops: no verify pass, no validation, no
// repair, because the point is to see what the WRITER produces unaided.
//
//   node scripts/minimal-cover.mjs <job-file> [--voice on|off]
//                                   [--emphasise "..."] [--play-down "..."]
//                                   [--freeform "..."]
//
// Steering composes through the REAL composeTweak() and is appended as the
// candidate's own instructions, so the control experiment can be compared with
// the pipeline on the one input the pipeline enforces in code.
//
// Read-only. Nothing is saved to Supabase.

import fs from 'node:fs';
import { getGenerationSource, getVoiceProfile } from '../utils/database.js';
import { callGemini, GEMINI_GENERATION_MODEL, verifyGeneratedDoc } from '../utils/openai.js';
import { enterAiContext } from '../utils/ai-meter.js';
import { validateCoverLetter, bannedPhraseHits, unsourcedDomainHits } from '../utils/cv-validate.js';
import { voiceProfileBlock, voiceExcerptBlock } from '../prompts/voice-profile.js';
import { composeTweak } from '../utils/steering.js';

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? '' : (process.argv[i + 1] || '');
};

const USER_EMAIL = 'npx10111@gmail.com';
const jobFile = process.argv[2];
const useVoice = process.argv.includes('--voice') ? process.argv[process.argv.indexOf('--voice') + 1] !== 'off' : false;
if (!jobFile) { console.error('usage: node scripts/minimal-cover.mjs <job-file> [--voice on|off]'); process.exit(1); }

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user } = await sb.from('users').select('user_id').eq('email', USER_EMAIL).single();

// This is an experiment, and an experiment is spend: attribute it so its calls
// land in `transactions` and count against the daily budget.
enterAiContext({ context: 'script:minimal-cover', user_id: user.user_id });

const master = await getGenerationSource(user.user_id);
const job = fs.readFileSync(jobFile, 'utf8');
const profile = useVoice ? await getVoiceProfile(user.user_id) : null;

// Nik's prompt, verbatim. The voice blocks are appended ONLY when --voice on,
// so the two halves of the comparison are separable.
const voice = profile ? `\n\n${voiceProfileBlock(profile)}${voiceExcerptBlock(profile)}` : '';
const tweak = composeTweak({ emphasise: argOf('emphasise'), playDown: argOf('play-down'), freeform: argOf('freeform') });
const steering = tweak
  ? `\n\nMy own instructions for this letter, which outrank everything above — what I ask you to foreground leads the letter and is proved with a real fact; what I ask you to play down stays out of the opening entirely, though it may appear once, late and plainly. Never invent anything to satisfy them:\n"${tweak}"`
  : '';
const prompt = `Write a tailored cover letter in English (150–250 words) using the job history and job description provided below.

Highlight the key achievements and skills from my history that directly align with the core requirements, responsibilities, and qualifications listed in the job description. Maintain a professional tone.

Job History:

${master}

Job Description:

${job}${voice}${steering}`;

const data = await callGemini(GEMINI_GENERATION_MODEL, [{ role: 'user', content: prompt }], { reasoning_effort: 'medium', temperature: 0.55 });
const letter = data.choices?.[0]?.message?.content || '';
console.log(`prompt: ${prompt.length} chars | voice: ${useVoice ? 'on' : 'off'} | model: ${GEMINI_GENERATION_MODEL}`);
if (tweak) console.log(`steering:\n${tweak}`);
console.log(`words: ${letter.split(/\s+/).filter(Boolean).length}`);
console.log('\n' + letter);

if (process.argv.includes('--check')) {
  console.log('\n══════ THE TRUTH PASSES, RUN OVER THAT LETTER ══════');
  const verified = await verifyGeneratedDoc({ document: letter, master, docType: 'cover', language: 'en' });
  console.log(`\nverify: ${verified.applied.length} correction(s)`);
  for (const a of verified.applied) {
    console.log(`  - [${a.reason}]\n      cut:  "${a.quote}"\n      for:  "${a.replacement || '(deleted)'}"`);
  }
  console.log(`\nbanned phrases: ${JSON.stringify(bannedPhraseHits(letter, 'en'))}`);
  console.log(`unsourced domains: ${JSON.stringify(unsourcedDomainHits(letter, master))}`);
  const v = validateCoverLetter(verified.content, { master, analysis: null, language: 'en' });
  console.log(`\nvalidateCoverLetter -> ok: ${v.ok}`);
  for (const h of v.hard) console.log(`  HARD: ${h}`);
  for (const w of v.warnings) console.log(`  warn: ${JSON.stringify(w)}`);
  if (verified.applied.length) console.log('\n--- the letter as it would be delivered ---\n' + verified.content);
}
