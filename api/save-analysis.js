import clientPromise from '../lib/mongo.js';

export default async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Wrong method' });

  const { text, documentType } = req.body;
  if (!text || !documentType) return res.status(400).json({ error: 'Missing data' });

  try {
    const client = await clientPromise;
    const db = client.db('cvpro');

    const result = await db.collection('parsedcv').insertOne({
      text,
      documentType,
      uploadedAt: new Date()
    });

    res.status(200).json({ insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: 'Mongo insert failed' });
  }
}
