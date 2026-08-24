#!/usr/bin/env node
// scripts/why-them.mjs
//
// Writes the ONE variable paragraph of the template cover letter
// (`cover-letter-template.md`, slot {{WHY_THEM}}) from a job ad.
//
// It is not the pipeline: no master CV, no analysis, no verify pass, no
// validation, no DB write. One Gemini call over the ad text alone. The rest of
// the letter is fixed prose Nik wrote, so the only thing a model decides here
// is the opening.
//
// The read is SOFT DATA — what the ad gives away without stating it (values,
// worry, goal, how they write) — never the product pitch. Nik's own "Core
// thought" notes in scripts/fixtures/ad-read_*/ are what this reproduces.
//
//   node scripts/why-them.mjs scripts/fixtures/ad-read_Faceup/Faceup.md
//
// Output is printed and written to runs/<date>_<ad>_why-them.md.

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const { callGemini, GEMINI_GENERATION_MODEL } = await import('../utils/openai.js');
const { enterAiContext } = await import('../utils/ai-meter.js');

const adFile = process.argv[2];
if (!adFile) { console.error('usage: node scripts/why-them.mjs <ad-file>'); process.exit(1); }
if (!process.env.GEMINI_API_KEYS) { console.error('✗ GEMINI_API_KEYS is not set (.env.local)'); process.exit(1); }

const ad = fs.readFileSync(adFile, 'utf8');

// A script that calls Gemini spends money, so it declares itself. No context,
// no call — callGemini refuses otherwise.
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user } = await sb.from('users').select('user_id').eq('email', 'npx10111@gmail.com').single();
enterAiContext({ context: 'script:why-them', user_id: user?.user_id });

// The fixed body of the letter is the ONLY thing the model may assume about the
// candidate. Without it the paragraph invents a career to agree with the ad.
const body = fs.readFileSync('cover-letter-template.md', 'utf8')
  .split('{{WHY_THEM}}')[1].split('---')[0].trim();

const prompt = `You are given a job ad.

First, read what it gives away that it does not state: what this company VALUES
(and the wording that shows it), what it is quietly worried about, what its goal
is, and what its own writing says about how it works — how detailed the ad is,
what it repeats, what it puts first, what it phrases in the negative, how formal
or loose the language is.

Keep that read to yourself. It tells you WHAT the paragraph is about; it is
never what the paragraph says.

Then write ONE paragraph, 50-80 words, to open a cover letter.

NEVER LECTURE THEM ABOUT THEIR OWN BUSINESS. No sentence that states how their
industry works, what usually goes wrong in it, what the hard part is, or what
most companies get wrong. They do this for a living and they know. A paragraph
that opens "Building X usually breaks down when..." is the failure this rule
exists to stop, and it is an instant rewrite.

THE PARAGRAPH ANSWERS ONE QUESTION AND NOTHING ELSE: WHY HE WANTS TO WORK
THERE. Not why he is qualified, not how he works, not what he brings. A WANT —
what he would get out of being there, what he wants to be part of, what he has
been looking for and thinks is here. If the paragraph could be moved to another
company's letter unchanged, it is wrong.

The want is aimed at what you inferred — how they work, what they hold to,
what kind of place this is — never at their product or their success.

TWO BANS, BOTH ABSOLUTE:

1. NOT ONE FACT ABOUT THE CANDIDATE beyond what the letter body below already
   says. No industry he has worked in, no tool, no language, no technology, no
   number of years, no employer, no skill. He does not read Python. He has not
   "worked across crypto applications". If the body does not say it, it does not
   exist, and a paragraph with no candidate fact at all is the correct outcome.

2. NO FORMULA OPENERS. Banned outright: "Having spent years...", "I know how
   rare it is to find...", "I'm looking for a team where...", "That is exactly
   what I've been looking for". Also banned: repeating the ad's own selling
   phrases back ("real ownership, not a slice of it", "meaningful product").
   Say the want in plain words a person would use out loud, and start it
   somewhere a stock letter would not. Do not describe, praise or explain their product. Do
not compliment the company. Do not quote the ad back. Do not tell them what they
value ("I recognise how much you value...").

Rules: no job title, no "I am writing to apply", no credo sentence ("To me, X
isn't about Y"), no adjectives about their success. Plain spoken, contractions
fine, must survive being said out loud across a table.

The paragraph is FINISHED PROSE: a complete last sentence, never a lead-in, never
a trailing "in my recent projects..." or an ellipsis. The paragraphs that follow
it are already written and are printed below — do not preview, summarise or
overlap them, and claim NOTHING about the candidate that they do not already
say. If you have nothing true to add about him, the paragraph is about what you
read in the ad and one plain sentence of recognition.

Return the paragraph only.

THE REST OF THE LETTER, ALREADY WRITTEN (context only — do not repeat it):

${body}

JOB AD:

${ad}`;

const data = await callGemini(
  GEMINI_GENERATION_MODEL,
  [{ role: 'user', content: prompt }],
  { reasoning_effort: 'medium', temperature: 0.7, label: 'why-them paragraph' },
);
const para = (data.choices?.[0]?.message?.content || '').trim();

const slug = path.basename(adFile).replace(/\.[^.]+$/, '').toLowerCase();
const date = new Date().toISOString().slice(0, 10);
const out = path.join('runs', `${date}_${slug}_why-them.md`);
fs.mkdirSync('runs', { recursive: true });
fs.writeFileSync(out, `${para}\n`);

console.log(`ad: ${adFile} | model: ${GEMINI_GENERATION_MODEL} | words: ${para.split(/\s+/).filter(Boolean).length}`);
console.log(`\n${para}\n\nwritten to ${out}`);
