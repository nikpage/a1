import { KeyManager } from '../js/key-manager.js';
import { buildJobMetadataExtractionPrompt } from '../js/prompt-builder.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const km = new KeyManager();
    const apiKey = km.keys[km.currentKeyIndex];
    if (!apiKey) {
      throw new Error('API key missing');
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
          { role: 'user', content: buildJobMetadataExtractionPrompt(text) }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const chatJson = await apiRes.json();
    const content = chatJson.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from DeepSeek');
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Invalid JSON from DeepSeek');
    }

    // Return extracted job metadata
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('API analyze-job error:', err);
    return res.status(500).json({ error: err.message });
  }
}
