#!/usr/bin/env node
// scripts/minimal-cv.mjs
//
// THE CONTROL EXPERIMENT, CV SIDE. The letter already has one
// (scripts/minimal-cover.mjs) and it settled the question: Nik's own four-line
// prompt beat the 51,721-character rule stack on the same record, the same ad
// and the same model. The CV generator still carries its full stack — layers
// 0-5, scenarios, market conventions, the section registry, the analysis brief
// — and that comparison has never been run on it.
//
// So this writes a CV from four lines: the master record, the ad, "highlight
// what aligns", a professional CV. Nothing else. No analysis pass, no verify,
// no validation, no repair — the point is to see what the WRITER produces
// unaided, so the stack can be compared with the thing it is supposed to beat.
//
//   node scripts/minimal-cv.mjs <job-file> [--out runs/<dir>]
//
// Read-only. Nothing is saved to Supabase.

import fs from 'node:fs';
import path from 'node:path';
import { getGenerationSource } from '../utils/database.js';
import { callGemini, GEMINI_GENERATION_MODEL } from '../utils/openai.js';
import { enterAiContext } from '../utils/ai-meter.js';
import { buildSkeleton, skeletonBlock } from '../prompts/cv-skeleton.js';

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? '' : (process.argv[i + 1] || '');
};

const USER_EMAIL = 'npx10111@gmail.com';
const jobFile = process.argv[2];
if (!jobFile) { console.error('usage: node scripts/minimal-cv.mjs <job-file> [--out runs/<dir>]'); process.exit(1); }

const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user } = await sb.from('users').select('user_id').eq('email', USER_EMAIL).single();

// This is an experiment, and an experiment is spend: attribute it so its call
// lands in `transactions` alongside every other Gemini call.
enterAiContext({ context: 'script:minimal-cv', user_id: user.user_id });

const master = await getGenerationSource(user.user_id);
const job = fs.readFileSync(jobFile, 'utf8');

// Work Experience is structured in code, not asked for — see prompts/cv-skeleton.js.
let record = null;
try { record = JSON.parse(master); } catch { record = null; }
const skeleton = record ? skeletonBlock(buildSkeleton(record)) : '';

// Nik's prompt, in the shape the letter's control uses, asking for a CV — plus
// the ORDER and STYLE he wants, and nothing else. The four lines choose the
// content; the template fixes the furniture. Everything mechanical (date
// format, graduation years, derived tenure) is a job for code afterwards, not
// for prompt bulk: that was the whole finding of the letter's control.
const prompt = `Write a tailored CV in English in Markdown using the job history and job description provided below.

Highlight the key achievements and skills from my history that directly align with the core requirements, responsibilities, and qualifications listed in the job description. Maintain a professional tone.

Use exactly this structure and order, and no other sections:

# Nik Page
**<headline: role | two or three domains>**
<phone> | <email> | <linkedin> | <site>

### **Highlights**
Three to five sentences of prose, no bullets, and its whole job is to make the reader want to read on carefully.

It opens on something concrete this person has done, never on adjectives about them ("high-agency", "proven track record", "extensive experience" and their like are banned here). It works from what THIS job most needs, naming the specific work that proves each — wherever that work sits in the history, whatever its date. It is not a contents page for the CV below it and does not walk through the roles in order.

### **Skills**
A single-column bullet list of short ATS terms — one to three words each, the words the job description itself uses where the history evidences them. Never a sentence, never a parenthetical, never a grouped phrase, never a label followed by a list.

### **Work Experience**
Reproduce the structure given at the end of this message under "The Work Experience section, already structured" exactly as written there — every heading, employer and date verbatim, in that order — and write only the bullets.

### **Speaking & Lecturing**
### **Publications**
### **Education**
### **Recognition**

Omit any of the last four sections the history has nothing for. Invent nothing.

Job History:

${master}

Job Description:

${job}

${skeleton}`;

const data = await callGemini(GEMINI_GENERATION_MODEL, [{ role: 'user', content: prompt }], { reasoning_effort: 'medium', temperature: 0.55 });
const cv = data.choices?.[0]?.message?.content || '';

console.log(`prompt: ${prompt.length} chars | model: ${GEMINI_GENERATION_MODEL}`);
console.log(`words: ${cv.split(/\s+/).filter(Boolean).length}`);
console.log('\n' + cv);

// Every paid run writes its output to a file — a run you cannot re-read is
// money spent twice.
const outDir = argOf('out') || `runs/${new Date().toISOString().slice(0, 10)}_${path.basename(jobFile).replace(/\.[^.]+$/, '')}_cv-minimal`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'cv.md'), cv);
console.log(`\nwritten: ${path.join(outDir, 'cv.md')}`);
