// path: pages/api/generate-cv-cover.js

import { getCvData, getCV, saveGeneratedDoc } from '../../utils/database';
import { getUserById, decrementGenerations, resetGenerations } from '../../utils/generation-utils';
import { generateCV, generateCoverLetter } from '../../utils/openai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, analysis, tone = 'Formal', type = 'both' } = req.body;
  if (!user_id || !analysis || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const user = await getUserById(user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const cost = type === 'both' ? 2 : 1;
  if (user.generations_left < cost) {
    return res.status(403).json({ error: 'Not enough generations left' });
  }

  let cvRecord;
  try {
    cvRecord = await getCV(user_id);
    if (!cvRecord || !cvRecord.cv_data) {
      return res.status(404).json({ error: 'CV not found for user' });
    }
  } catch (dbErr) {
    return res.status(500).json({ error: 'Error fetching CV data' });
  }

  let cvRes = null;
  let coverRes = null;
  let cv = null;
  let cover = null;

  try {
    if (type === 'cv' || type === 'both') {
      cvRes = await generateCV({ cv: cvRecord.cv_data, analysis, tone });
cv = cvRes.content;       await saveGeneratedDoc({
        user_id,
        source_cv_id: user_id,
        type: 'cv',
        tone,
        file_name: 'Generated_CV.txt',
        content: cv
      });
    }

    if (type === 'cover' || type === 'both') {
      coverRes = await generateCoverLetter({ cv: cvRecord.cv_data, analysis, tone });
      cover = coverRes.content;
      await saveGeneratedDoc({
        user_id,
        source_cv_id: user_id,
        type: 'cover',
        tone,
        file_name: 'Generated_Cover_Letter.txt',
        content: cover
      });
    }

    setTimeout(() => decrementGenerations(user_id, cost), 500);
    const updatedUser = await getUserById(user_id);
    if (updatedUser.generations_left === 0) await resetGenerations(user_id);

    const logTx = async (docType, usage = {}) => {
    const baseURL =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : `https://${process.env.VERCEL_URL}`;
    const urlToFetch = `${baseURL}/api/log-transaction`;

    await fetch(urlToFetch, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id,
        source_gen_id: crypto.randomUUID(),
        model: 'DS-v3',
        cache_hit_tokens: usage.prompt_cache_hit_tokens || 0,
        cache_miss_tokens: usage.prompt_cache_miss_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        job_title: null,
        company: null,
        tone
      })
    });
  };


  

    if (type === 'cv' || type === 'both') await logTx('cv', cvRes?.usage || {});
    if (type === 'cover' || type === 'both') await logTx('cover', coverRes?.usage || {});

    return res.status(200).json({
      ...(cv && { cv }),
      ...(cover && { cover })
    });
  } catch (err) {
    console.error('Generation error:', err);
    return res.status(500).json({ error: 'Generation failed' });
  }
}
