// Stripped writer: exemplars + record + ad. Nothing else.
import fs from 'node:fs';
import { getGenerationSource } from '../utils/database.js';
import { callGemini, GEMINI_GENERATION_MODEL } from '../utils/openai.js';
import { enterAiContext, setAiContext } from '../utils/ai-meter.js';
import { letterExemplarBlock } from '../prompts/letter-exemplar.js';

const jobFile = process.argv[2];
const outDir = process.argv[3];
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user } = await sb.from('users').select('user_id').eq('email', 'npx10111@gmail.com').single();
const adTag = jobFile.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
enterAiContext({ context: `strip-cover · ${adTag} · exemplars only` });
setAiContext({ user_id: user.user_id });

const master = await getGenerationSource(user.user_id);
const job = fs.readFileSync(jobFile, 'utf8');

const prompt = `Write my application letter for the job below. First person, as me. 250-350 words.
Nothing invented: every fact comes from my record.

${letterExemplarBlock()}

# The job ad
${job}

# My record — the only source of fact
${master}

Return only the letter: the date, the salutation, the body, and a signature block with my name, phone, email and LinkedIn from the record.`;

const data = await callGemini(GEMINI_GENERATION_MODEL, [{ role: 'user', content: prompt }], { reasoning_effort: 'medium', temperature: 0.55, label: `write letter · ${adTag}` });
const letter = data.choices?.[0]?.message?.content || '';
console.error(`prompt ${prompt.length} chars`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/cover.md`, letter);
console.error(`wrote ${outDir}/cover.md`);
