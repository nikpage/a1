// pages/api/generate-cv-cover.js

import { getCvData, getCV, saveGeneratedDoc, logAiTransaction } from '../../utils/database';
import { getUserById, decrementGenerations } from '../../utils/generation-utils';
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

  const { user_id, analysis: analysisRaw, tone = 'Formal', type = 'both' } = req.body;
  if (!user_id || !analysisRaw || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let analysis;
  try {
    analysis = typeof analysisRaw === 'string' ? JSON.parse(analysisRaw) : analysisRaw;
  } catch {
    return res.status(400).json({ error: 'Invalid analysis JSON' });
  }

  let user;
  try {
    user = await getUserById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
  } catch (userErr) {
    console.error('User fetch error:', userErr);
    return res.status(500).json({ error: 'Error fetching user data' });
  }

  // Check generations before generating
  if (user.generations_left <= 0) {
    return res.status(403).json({ error: 'NO_GENERATIONS_LEFT' });
  }

  // Check tokens before generating
  if (user.tokens <= 0) {
    return res.status(403).json({ error: 'NO_TOKENS_LEFT' });
  }

  // Decrement immediately
  try {
    await decrementGenerations(user_id, 1);
  } catch (decErr) {
    console.error('Decrement error:', decErr);
    return res.status(500).json({ error: 'Error decrementing generations' });
  }

  let cvRecord;
  try {
    cvRecord = await getCV(user_id);
    if (!cvRecord || !cvRecord.cv_data) {
      return res.status(404).json({ error: 'CV not found for user' });
    }
  } catch (dbErr) {
    console.error('CV fetch error:', dbErr);
    return res.status(500).json({ error: 'Error fetching CV data' });
  }

  let cvRes = null;
  let coverRes = null;
  let cv = null;
  let cover = null;

  try {
    if (type === 'cv' || type === 'both') {
      cvRes = await generateCV({ cv: cvRecord.cv_data, analysis, tone });
      cv = cvRes.content;
      await saveGeneratedDoc({
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

    if (type === 'cv' || type === 'both') {
      await logAiTransaction({
        user_id,
        source_gen_id: crypto.randomUUID(),
        model: 'gemini-3.5-flash',
        cache_hit_tokens: cvRes?.usage?.prompt_cache_hit_tokens || 0,
        cache_miss_tokens: cvRes?.usage?.prompt_cache_miss_tokens || 0,
        completion_tokens: cvRes?.usage?.completion_tokens || 0,
        detail: { tone, type: 'cv' },
      });
    }
    if (type === 'cover' || type === 'both') {
      await logAiTransaction({
        user_id,
        source_gen_id: crypto.randomUUID(),
        model: 'gemini-3.5-flash',
        cache_hit_tokens: coverRes?.usage?.prompt_cache_hit_tokens || 0,
        cache_miss_tokens: coverRes?.usage?.prompt_cache_miss_tokens || 0,
        completion_tokens: coverRes?.usage?.completion_tokens || 0,
        detail: { tone, type: 'cover' },
      });
    }

    const gemini_usage = [
      ...(cvRes?.gemini_usage ? [cvRes.gemini_usage] : []),
      ...(coverRes?.gemini_usage ? [coverRes.gemini_usage] : []),
    ];
    return res.status(200).json({
      ...(cv && { cv }),
      ...(cover && { cover }),
      gemini_usage
    });
  } catch (err) {
    const detail = err?.response?.data || err?.message || 'unknown';
    console.error('Generation error:', detail);
    return res.status(500).json({ error: 'Generation failed', detail });
  }
}
