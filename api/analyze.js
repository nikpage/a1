// api/analyze.js
import { KeyManager } from '../js/key-manager.js';
import { buildCVMetadataExtractionPrompt } from '../js/prompt-builder.js';
import clientPromise from '../lib/mongo.js';

const km = new KeyManager();
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text, filename, token } = req.body;
    if (!text || !token) {
      return res.status(400).json({ error: 'text and token are required' });
    }

    // 1) Call DeepSeek for metadata
    const apiKey = km.keys[0];
    const deepSeekRes = await fetch(
      'https://api.deepseek.com/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'user', content: buildCVMetadataExtractionPrompt(text) }
          ],
          response_format: { type: 'json_object' }
        })
      }
    );
    if (!deepSeekRes.ok) {
      const err = await deepSeekRes.text();
      throw new Error(`DeepSeek API Error: ${deepSeekRes.status} — ${err}`);
    }
    const raw = await deepSeekRes.text();
    const parsedOuter = JSON.parse(raw);
    const inner = parsedOuter.choices[0].message.content || '{}';
    const parsed = JSON.parse(inner);

    // 2) Connect to Mongo
    const client = await clientPromise;
    const db = client.db('cvpro');

    // 3) Ensure collections exist
    for (const name of ['users', 'cvmetadata', 'cvdata']) {
      try { await db.createCollection(name); } catch {}
    }

    // 4) Seed master user (upsert)
    await db
      .collection('users')
      .updateOne(
        { token },
        { $setOnInsert: { email: 'you@yourdomain.com', role: 'master', createdAt: new Date() } },
        { upsert: true }
      );

    // 5) Write parsed metadata
    await db.collection('cvmetadata').insertOne({
      userId: token,
      metadata: parsed.metadata,
      createdAt: new Date()
    });

    // 6) Write raw CV text
    await db.collection('cvdata').insertOne({
      userId: token,
      cvBody: text,
      createdAt: new Date()
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[ANALYZE ERROR]', err);
    return res.status(500).json({ error: err.message });
  }
}
