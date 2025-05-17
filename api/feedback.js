// api/feedback.js
import clientPromise from '../lib/mongo.js';
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { token, finalFeedback } = req.body;
    if (!token || !finalFeedback) {
      return res.status(400).json({ error: 'Token and feedback are required.' });
    }

    const client = await clientPromise;
    const db = client.db('cvpro');

    // Ensure cvdata and feedback collections exist
    for (const name of ['cvdata', 'feedback']) {
      try { await db.createCollection(name); } catch {}
    }

    // 1) update cvdata with final CV text
    await db.collection('cvdata').updateOne(
      { userId: token },
      { $set: { finalCv: finalFeedback, updatedAt: new Date() } }
    );

    // 2) save the AI feedback
    await db.collection('feedback').insertOne({
      userId: token,
      feedback: finalFeedback,
      createdAt: new Date()
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[ERROR]', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
