// Stripped writer: exemplars + record + ad. Nothing else.
import fs from 'node:fs';
import { getGenerationSource, getVoiceProfile } from '../utils/database.js';
import { callGemini, GEMINI_GENERATION_MODEL } from '../utils/openai.js';
import { enterAiContext, setAiContext } from '../utils/ai-meter.js';
import { letterExemplarBlock } from '../prompts/letter-exemplar.js';
import { voiceExcerptBlock } from '../prompts/voice-profile.js';

const jobFile = process.argv[2];
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user } = await sb.from('users').select('user_id').eq('email', 'npx10111@gmail.com').single();
enterAiContext({ context: 'script:strip-cover' });
setAiContext({ user_id: user.user_id });

const master = await getGenerationSource(user.user_id);
const profile = await getVoiceProfile(user.user_id);
const job = fs.readFileSync(jobFile, 'utf8');

const prompt = `Write my application letter for the job below. First person, as me. 250-350 words.
Nothing invented: every fact comes from my record.

${letterExemplarBlock()}
${profile ? voiceExcerptBlock(profile) : ''}

# The job ad
${job}

# My record — the only source of fact
${master}

Return only the letter: the date, the salutation, the body, and a signature block with my name, phone, email and LinkedIn from the record.`;

const data = await callGemini(GEMINI_GENERATION_MODEL, [{ role: 'user', content: prompt }], { reasoning_effort: 'medium', temperature: 0.55, label: 'strip cover' });
const letter = data.choices?.[0]?.message?.content || '';
console.error(`prompt ${prompt.length} chars`);
console.log(letter);
