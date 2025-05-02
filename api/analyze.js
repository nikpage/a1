// File: /api/analyze.js
// A simple Next.js ESM API route for DeepSeek analysis
// Parses JSON body, fetches DeepSeek, and returns feedback or errors

import { KeyManager } from '../js/key-manager.js';
const km = new KeyManager();

// Ensure Next.js parses JSON bodies
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Parse and validate input
    const { text, documentType } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Retrieve DeepSeek API key
    const apiKey = km.keys[0];
    if (!apiKey) {
      throw new Error('DeepSeek API key missing in KeyManager');
    }

    // Call DeepSeek service
    const apiRes = await fetch('https://api.deepseek.io/v1/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ text, documentType }),
    });

    // Handle DeepSeek errors
    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    // Parse response and track usage
    const { feedback, usage } = await apiRes.json();
    km.trackUsage(usage);

    // Return feedback to client
    return res.status(200).json({ feedback });

  } catch (err) {
    console.error('API /analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
