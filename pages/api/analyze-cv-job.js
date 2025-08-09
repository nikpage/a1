// pages/api/analyze-cv-job.js
import { getCvData, saveGeneratedDoc } from '../../utils/database';
import { analyzeCvJob } from '../../utils/openai';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { KeyManager } from '../../utils/key-manager.js';

const keyManager = new KeyManager();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Direct logging function instead of HTTP call
async function logTransaction(data) {
  try {
    const { data: result, error } = await supabase
      .from('user_transactions')
      .insert([{
        user_id: data.user_id,
        source_gen_id: data.source_gen_id,
        model: data.model,
        completion_tokens: data.completion_tokens,
        cache_hit_tokens: data.cache_hit_tokens,
        cache_miss_tokens: data.cache_miss_tokens,
        job_title: data.job_title,
        company: data.company,
        key_index: data.key_index,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      console.error('Transaction logging error:', error);
    }
  } catch (err) {
    console.error('Transaction logging failed:', err);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, jobText, created_at } = req.body;
  const fileName = req.body.file_name || 'Unnamed file';

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id in request body' });
  }

  try {
    let query = supabase
      .from('cv_data')
      .select('cv_data')
      .eq('user_id', user_id);

    if (created_at) {
      query = query.eq('created_at', created_at);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return res.status(404).json({ error: 'CV not found for given timestamp' });
    }

    const cv_data = data.cv_data;

    if (!cv_data) {
      return res.status(400).json({ error: 'CV data is empty' });
    }

    const result = await analyzeCvJob(cv_data, jobText, fileName);

    const content = result?.output || null;

    const extractMeta = (label) => {
      const match = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
      return match ? match[1].trim() : null;
    };

    const company = extractMeta('Company Name');
    const job_title = extractMeta('Position/Title');
    const hr_contact = extractMeta('HR Contact');

    if (!content) {
      return res.status(500).json({ error: 'No analysis content returned by DeepSeek', raw: result });
    }

    const analysis_id = crypto.randomUUID();

    await saveGeneratedDoc({
      user_id,
      source_cv_id: user_id,
      type: 'analysis',
      tone: null,
      company,
      job_title,
      file_name: null,
      content,
      analysis_id,
      hr_contact,
    });

    // Send response immediately
    res.status(200).json({ analysis: content, analysis_id });

    // Log transaction directly without HTTP call
    const usage = result?.usage || {};
    logTransaction({
      user_id,
      source_gen_id: analysis_id,
      model: 'DS-v3',
      completion_tokens: usage.completion_tokens || 0,
      cache_hit_tokens: usage.prompt_cache_hit_tokens || 0,
      cache_miss_tokens: usage.prompt_cache_miss_tokens || 0,
      job_title,
      company,
      key_index: keyManager.currentKeyIndex
    });

  } catch (e) {
    console.error('API Error:', e.message);
    if (e.response?.data) {
      console.error('DeepSeek API Response Error:', e.response.data);
    }
    return res.status(500).json({ error: e.message });
  }
}
