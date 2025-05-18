// pages/api/analyze.js
import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key for server-side
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const km = new KeyManager();

// Enable JSON body parsing
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Reject non-POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Shared secret check
  const incoming = req.headers['x-api-secret'];
  if (incoming !== process.env.API_SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const apiKey = km.keys[km.currentKeyIndex];
    if (!apiKey) throw new Error('API key missing');

    // Call DeepSeek
    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: buildCVMetadataExtractionPrompt(text) }],
        response_format: { type: 'json_object' }
      })
    });
    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const chatJson = await apiRes.json();
    let metadata = chatJson.choices[0].message.content;
    try {
      metadata = JSON.parse(metadata);
    } catch {
      throw new Error('Invalid JSON from DeepSeek');
    }

    // Save to Supabase: create user and cv_metadata row
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ email: metadata.email || 'unknown@example.com', token_balance: 0, secret: crypto.randomUUID() }])
      .single();
    if (userError) throw userError;

    const { data: cvMeta, error: metaError } = await supabase
      .from('cv_metadata')
      .insert([{ user_id: user.id, file_url: metadata.file_url || null, data: metadata }])
      .single();
    if (metaError) throw metaError;

    // Respond with saved metadata
    return res.status(200).json({ metadata: cvMeta });
  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
