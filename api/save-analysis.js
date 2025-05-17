import crypto from 'crypto';
import clientPromise from '../mongo.js';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { rawText, analysis } = req.body;

    if (!rawText || !analysis) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const secretId = crypto.randomUUID();
    const client   = await clientPromise;
    const db       = client.db();

    await db.collection('sessions').insertOne({
      secretId,
      rawText,
      analysis,
      createdAt: new Date()
    });

    console.log('🔗 Session Link:', `/session/${secretId}`);
    console.log('🔗 Generated secretId:', secretId);

    return res.status(200).json({ secretId });

  } catch (err) {
    console.error('API save-analysis error:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).end(JSON.stringify({ error: err.message }));
  }
}
