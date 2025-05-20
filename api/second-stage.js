// /api/second-stage.js
import { KeyManager } from '../js/key-manager.js';
import { buildCVFeedbackPrompt } from '../js/prompt-builder.js';

const km = new KeyManager();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ONLY these three fields are required now:
  const { userId, metadata, cv_body } = req.body;
  if (!userId || !metadata || !cv_body) {
    return res
      .status(400)
      .json({ error: 'userId, metadata and cv_body are required.' });
  }

  // build absolute URL to your own /api/db
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host  = req.headers['host'];
  const dbUrl = `${proto}://${host}/api/db`;

  try {
    // 1) Upsert user+metadata via /api/db
    const dbRes = await fetch(dbUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, metadata, cv_body })
    });
    if (!dbRes.ok) {
      const body = await dbRes.text();
      console.error('DB upsert failed:', body);
      return res.status(502).json({ error: 'DB upsert failed', detail: body });
    }

    // 2) Build prompt and call DeepSeek for feedback
    const prompt = buildCVFeedbackPrompt();
    const fullPrompt =
      prompt +
      '\n\nMETADATA:\n' + JSON.stringify(metadata) +
      '\n\nCV TEXT:\n' + cv_body;

    const deepRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${km.keys[km.currentKeyIndex]}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: fullPrompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!deepRes.ok) {
      const errTxt = await deepRes.text();
      console.error('DeepSeek stage2 error:', errTxt);
      return res.status(502).json({ error: 'DeepSeek failed', detail: errTxt });
    }

    const deepJson = await deepRes.json();
    let finalFeedback;
    try {
      finalFeedback = JSON.parse(deepJson.choices[0].message.content);
    } catch (parseErr) {
      console.error('Invalid JSON from DeepSeek:', deepJson.choices[0].message.content);
      return res.status(502).json({ error: 'Invalid JSON from DeepSeek' });
    }

    // 3) Return only JSON—no HTML ever
    return res.status(200).json({ finalFeedback });

  } catch (err) {
    console.error('Second-stage error:', err);
    return res.status(500).json({ error: err.message });
  }
}
