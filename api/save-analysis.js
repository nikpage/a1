import clientPromise from '../../lib/mongo';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, documentType } = req.body;
  if (!text || !documentType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('cvpro');

    const result = await db.collection('parsedcv').insertOne({
      text,
      documentType,
      uploadedAt: new Date()
    });

    return res.status(200).json({ insertedId: result.insertedId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
}
