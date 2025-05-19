// /api/second-stage.js
import { KeyManager } from '../js/key-manager.js';
import { buildFeedbackPrompt } from '../js/prompt-builder.js';

const km = new KeyManager();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, metadata, cv_body, feedback } = req.body;
  if (!userId || !metadata || !cv_body || !feedback) {
    return res
      .status(400)
      .json({ error: 'userId, metadata, cv_body and feedback are required.' });
  }

  try {
    // 1) Ensure user + metadata in your DB via your central handler
    const dbRes = await fetch(`${req.headers.origin}/api/db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, metadata, cv_body })
    });
    if (!dbRes.ok) {
      const errTxt = await dbRes.text();
      throw new Error(`DB upsert failed: ${errTxt}`);
    }

    // 2) Call DeepSeek for second‐stage feedback processing
    const apiKey = km.keys[km.currentKeyIndex];
    console.log('[DeepSeek 2nd-stage] Using Key index:', km.currentKeyIndex);

    const deepRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: buildFeedbackPrompt(metadata, feedback) }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!deepRes.ok) {
      const errTxt = await deepRes.text();
      throw new Error(`DeepSeek error ${deepRes.status}: ${errTxt}`);
    }

    const deepJson = await deepRes.json();
    let feedbackResult;
    try {
      feedbackResult = JSON.parse(deepJson.choices[0].message.content);
    } catch {
      throw new Error('Invalid JSON from DeepSeek in stage 2');
    }

    // 3) Return the processed feedback to the client
    return res.status(200).json({ feedbackResult });

  } catch (err) {
    console.error('Second-stage error:', err);
    return res.status(500).json({ error: err.message });
  }
}
