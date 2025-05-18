// pages/api/analyze.js
import { randomUUID } from 'crypto';
import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key for server-side
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const km = new KeyManager();

// Enable JSON body parsing
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Shared secret verification
  const incoming = req.headers['x-api-secret'];
  const secret = process.env.API_SHARED_SECRET;
  if (!secret || incoming !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Fetch metadata from DeepSeek
    const apiKey = km.keys[km.currentKeyIndex];
    if (!apiKey) {
      throw new Error('DeepSeek API key missing');
    }

    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: buildCVMetadataExtractionPrompt(text) }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errorText}`);
    }

    const json = await apiRes.json();
    let metadata = json.choices?.[0]?.message?.content;
    try {
      metadata = JSON.parse(metadata);
    } catch {
      throw new Error('Invalid JSON from DeepSeek');
    }

    // 1) Create new user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        email: metadata.email || 'unknown@example.com',
        token_balance: 0,
        secret: randomUUID()
      }])
      .single();
    if (userError) throw userError;

    // 2) Insert CV metadata
    const { data: cvMeta, error: cvError } = await supabase
      .from('cv_metadata')
      .insert([{
        user_id: user.id,
        file_url: metadata.file_url || null,
        data: metadata
      }])
      .single();
    if (cvError) throw cvError;

    // Respond with saved record
    return res.status(200).json({ metadata: cvMeta });

  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
