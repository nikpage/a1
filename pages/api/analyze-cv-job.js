// pages/api/analyze-cv-job.js
import { saveGeneratedDoc, logAiTransaction } from '../../utils/database';
import { analyzeCvJob } from '../../utils/openai';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { KeyManager } from '../../utils/key-manager.js';

const keyManager = new KeyManager();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// In-memory rate limiter (per IP, 5 req/hour)
const requestCounts = new Map();

function cleanupOldEntries() {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) requestCounts.delete(ip);
  }
}

function sseWrite(res, event, payload) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  cleanupOldEntries();
  const current = requestCounts.get(ip) || { count: 0, resetTime: now + hour };
  if (current.count >= 5) {
    return res.status(429).json({ error: 'Too many requests. Try again in an hour.' });
  }
  current.count++;
  current.resetTime = now + hour;
  requestCounts.set(ip, current);

  if (req.body && JSON.stringify(req.body).length > 200000) {
    return res.status(413).json({ error: 'File too large' });
  }

  const { user_id, jobText, created_at } = req.body;
  const fileName = req.body.file_name || 'Unnamed file';

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id in request body' });
  }

  // Switch to SSE streaming so the client gets keep-alive pings while Gemini thinks
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
  res.flushHeaders();

  const pingInterval = setInterval(() => {
    try { sseWrite(res, 'ping', { status: 'thinking' }); } catch (_) {}
  }, 4000);

  const done = (event, payload) => {
    clearInterval(pingInterval);
    try {
      sseWrite(res, event, payload);
      res.end();
    } catch (_) {}
  };

  try {
    let query = supabase
      .from('cv_data')
      .select('cv_data')
      .eq('user_id', user_id);

    if (created_at) query = query.eq('created_at', created_at);

    const { data, error } = await query.single();

    if (error || !data) {
      return done('error', { error: 'CV not found for given timestamp' });
    }

    const cv_data = data.cv_data;
    if (!cv_data) return done('error', { error: 'CV data is empty' });

    const result = await analyzeCvJob(cv_data, jobText, fileName);
    const content = result?.output || null;

    if (!content) return done('error', { error: 'No analysis content returned' });

    const extractMeta = (label) => {
      const match = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
      return match ? match[1].trim() : null;
    };

    const company = extractMeta('Company Name');
    const job_title = extractMeta('Position/Title');
    const hr_contact = extractMeta('HR Contact');

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

    const usage = result?.usage || {};
    await logAiTransaction({
      user_id,
      source_gen_id: analysis_id,
      model: 'gemini-3.5-flash',
      completion_tokens: usage.completion_tokens || 0,
      cache_hit_tokens: usage.prompt_cache_hit_tokens || 0,
      cache_miss_tokens: usage.prompt_cache_miss_tokens || 0,
      detail: { job_title, company },
      key_index: keyManager.currentKeyIndex,
    });

    done('result', { analysis: content, analysis_id, gemini_usage: result.gemini_usage });

  } catch (e) {
    console.error('API Error:', e.message);
    if (e.response?.data) console.error('Gemini API Response Error:', e.response.data);

    if (e.isRateLimit || e.response?.status === 429) {
      return done('error', { error: 'AI service is busy. Please try again in a moment.', status: 429 });
    }
    if (e.response?.status === 402) {
      return done('error', { error: 'AI service temporarily unavailable. Please try again shortly.', status: 503 });
    }
    done('error', { error: e.message, status: 500 });
  }
}
