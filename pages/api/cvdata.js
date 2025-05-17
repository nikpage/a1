// pages/api/cvdata .js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = 'cvreview';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    const body = req.body;
    const { cvMetadataId, sections } = body;

    if (!cvMetadataId || !sections) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    if (!client.topology || !client.topology.isConnected()) {
      await client.connect();
    }
    const db = client.db(dbName);

    const result = await db.collection('cvdata').insertOne({
      cvMetadataId,
      sections,
      updatedAt: new Date()
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
