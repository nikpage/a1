#!/usr/bin/env node
// scripts/assemble-cv.mjs
//
// The CV is ASSEMBLED IN CODE. The model is asked for prose and bullets as
// DATA; this file writes the document.
//
// Why: on 2026-08-25 the structure was put to the writer three ways — stated as
// rules in the production prompt, written out verbatim as a skeleton in that
// prompt, and written out verbatim in a four-line minimal prompt. All three runs
// dissolved the client engagements into the parent's bullets, and the minimal
// one also dropped every heading, re-dated everything long-form and printed
// roles back to 1993. A structure the model can restate is a structure it can
// ignore. So it never sees a document shape again: it answers a list of slots.
//
//   node scripts/assemble-cv.mjs <job-file> [--out runs/<dir>]
//
// One Gemini call. Read-only — nothing is saved to Supabase.

import fs from 'node:fs';
import path from 'node:path';
import { getGenerationSource, getMasterCv } from '../utils/database.js';
import { callGemini, GEMINI_GENERATION_MODEL } from '../utils/openai.js';
import { enterAiContext } from '../utils/ai-meter.js';
import { buildSkeleton, skeletonSlots } from '../prompts/cv-skeleton.js';
import { assembleCv } from '../prompts/cv-assemble.js';

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? '' : (process.argv[i + 1] || '');
};

const USER_EMAIL = 'npx10111@gmail.com';
const jobFile = process.argv[2];
if (!jobFile) { console.error('usage: node scripts/assemble-cv.mjs <job-file> [--out runs/<dir>]'); process.exit(1); }

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user } = await sb.from('users').select('user_id').eq('email', USER_EMAIL).single();

enterAiContext({ context: 'script:assemble-cv', user_id: user.user_id });

// The STRUCTURE comes from the stored record itself; the writer's factual
// source stays the prose rendering, which is what every other prompt reads.
const masterText = await getGenerationSource(user.user_id);
const master = await getMasterCv(user.user_id);
if (!master) { console.error('no stored master for this user'); process.exit(1); }
const job = fs.readFileSync(jobFile, 'utf8');

const skeleton = buildSkeleton(master);
const slots = skeletonSlots(skeleton);

const prompt = `You are writing the content of a tailored CV. Highlight the achievements and skills from the career record that directly align with the requirements, responsibilities and qualifications in the job description. Professional tone. Invent nothing: every claim comes from the record.

Return ONE JSON object and nothing else, in this exact shape:

{
  "headline": "role | two or three domains, max ~8 words",
  "highlights": "three to five sentences of prose",
  "skills": ["short ATS term", "..."],
  "bullets": { "<slot key>": ["bullet", "..."] },
  "speaking": ["Topic — Event, Location Year", "..."],
  "publications": ["Title", "..."],
  "recognition": ["Certification or award", "..."]
}

Rules for each field:

- "headline" opens on what this person does, never on an adjective about them.
- "highlights" opens on something concrete they have done — never on "high-agency", "proven track record", "extensive experience" or their like. It works from what THIS job most needs and names the specific work that proves each. It is not a summary of the CV below it and does not walk through the roles in order.
- "skills": one to three words each, the words the job description itself uses, only where the record evidences them. Never a sentence, never a parenthetical, never a grouped phrase.
- "bullets": the keys are EXACTLY the slot keys listed below, and no others. Each bullet leads with the result, then the action, and uses only figures the record states. Give an entry the number of bullets this job justifies — one for an entry the job has no use for, more for the ones that answer it. Every key must be present.
- "speaking" and "publications": choose ONLY the entries whose SUBJECT answers this job, most relevant first. Not the whole list, not the most recent. Return an empty array if the record holds nothing on point. Always include at least one Dev Challenge X, Kyiv entry.
- "recognition": certifications and awards from the record.

The slot keys, in document order — return a bullets array for every one of them:

${slots.map((s) => `  "${s.key}"   (${s.title})`).join('\n')}

Career record:

${masterText}

Job description:

${job}`;

const data = await callGemini(GEMINI_GENERATION_MODEL, [{ role: 'user', content: prompt }], { reasoning_effort: 'medium', temperature: 0.55 });
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

// The document is written in code by prompts/cv-assemble.js — the same
// assembler the app uses, so what is judged here is what a user receives.
// Kyiv is always represented: the record's Dev Challenge X judging is the entry
// Nik wants on every CV, and that preference is his, not the product's, so it
// is applied HERE and not inside the shared assembler.
const speakingAll = Array.isArray(master.speaking_and_lecturing) ? master.speaking_and_lecturing : [];
const chosen = Array.isArray(out.speaking) ? out.speaking.filter(Boolean) : [];
if (chosen.length && !chosen.some((s) => /kyiv/i.test(s))) {
  const kyiv = speakingAll.find((e) => /kyiv/i.test(e?.location || ''));
  if (kyiv) chosen.push(`${kyiv.role}: ${kyiv.topic} — ${kyiv.event}, ${kyiv.location} ${kyiv.year}`);
}

const cv = assembleCv(master, { ...out, speaking: chosen }, skeleton, { language: 'en' });

const list = (arr) => (Array.isArray(arr) ? arr.filter(Boolean) : []);

// what the model was asked for versus what it returned — a missing slot is a
// heading with no bullets, and the reader should know which.
const missing = slots.filter((s) => !list(out.bullets?.[s.key]).length).map((s) => s.key);
console.log(`prompt: ${prompt.length} chars | slots: ${slots.length} | bullets returned for: ${slots.length - missing.length}`);
if (missing.length) console.log(`no bullets for: ${missing.join(', ')}`);
console.log('\n' + cv);

const outDir = argOf('out') || `runs/${new Date().toISOString().slice(0, 10)}_${path.basename(jobFile).replace(/\.[^.]+$/, '')}_cv-assembled`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'cv.md'), cv);
fs.writeFileSync(path.join(outDir, 'model-output.json'), JSON.stringify(out, null, 2));
console.log(`\nwritten: ${path.join(outDir, 'cv.md')}`);
