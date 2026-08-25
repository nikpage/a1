#!/usr/bin/env node
// scripts/assemble-cover.mjs
//
// The cover letter is ASSEMBLED IN CODE from Nik's own paragraphs
// (prompts/letter-library.js). The model does two things and no more: it picks
// which paragraphs answer this ad, and it writes the opening stance where none
// of his openings fit.
//
//   node scripts/assemble-cover.mjs <job-file> [--out runs/<dir>] [--lang en|cs|pl]
//
// One Gemini call. Read-only — nothing is saved to Supabase.

import fs from 'node:fs';
import path from 'node:path';
import { getGenerationSource, getMasterCv } from '../utils/database.js';
import { callGemini, GEMINI_GENERATION_MODEL } from '../utils/openai.js';
import { enterAiContext } from '../utils/ai-meter.js';
import { OPENINGS } from '../prompts/letter-library.js';
import { buildLetterPickPrompt } from '../prompts/letter-pick.js';
import { assembleCover } from '../prompts/letter-assemble.js';

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? '' : (process.argv[i + 1] || '');
};

const USER_EMAIL = 'npx10111@gmail.com';
const jobFile = process.argv[2];
if (!jobFile) { console.error('usage: node scripts/assemble-cover.mjs <job-file> [--out runs/<dir>] [--lang en]'); process.exit(1); }

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user } = await sb.from('users').select('user_id').eq('email', USER_EMAIL).single();

enterAiContext({ context: 'script:assemble-cover', user_id: user.user_id });

const master = await getMasterCv(user.user_id);
if (!master) { console.error('no stored master for this user'); process.exit(1); }
const masterText = await getGenerationSource(user.user_id);
const job = fs.readFileSync(jobFile, 'utf8');
const language = argOf('lang') || 'en';

// ONE prompt, shared with the app path (utils/openai.js) so the harness cannot
// judge a prompt the user never gets.
const messages = buildLetterPickPrompt({ job, master: masterText });

const data = await callGemini(GEMINI_GENERATION_MODEL, messages, { reasoning_effort: 'medium', temperature: 0.55 });
const raw = data.choices?.[0]?.message?.content || '';
const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);

let out;
try {
  out = JSON.parse(json);
} catch (err) {
  console.error('model did not return parseable JSON:', err.message);
  console.error(raw.slice(0, 800));
  process.exit(1);
}

const letter = assembleCover(master, out, { language });

const openingSource = out.opening === 'custom'
  ? 'WRITTEN BY THE MODEL'
  : OPENINGS.some((o) => o.id === out.opening) ? `his own (${out.opening})` : 'MISSING';

console.log(`prompt: ${messages.map((m) => m.content.length).reduce((a, b) => a + b, 0)} chars`);
console.log(`opening: ${openingSource} | instances: ${(out.instances || []).join(', ')} | day-to-day: ${out.day_to_day} | close: ${out.close} | contact: ${out.contact_name || '(none named)'}`);
console.log(`words: ${letter.split(/\s+/).filter(Boolean).length}`);
console.log('\n' + letter);

const outDir = argOf('out') || `runs/${new Date().toISOString().slice(0, 10)}_${path.basename(jobFile).replace(/\.[^.]+$/, '')}_cover-assembled`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'cover.md'), letter);
fs.writeFileSync(path.join(outDir, 'model-output.json'), JSON.stringify(out, null, 2));
console.log(`\nwritten: ${path.join(outDir, 'cover.md')}`);
