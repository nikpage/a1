// api/cvdata.js
import { connectDB } from '../lib/mongo.js';

export default async function handler(req, res) {
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  const rawBody = Buffer.concat(buffers).toString();

  try {
    const body = JSON.parse(rawBody);
    const { cvMetadataId, sections } = body;
    const db = await connectDB();
    const result = await db.collection('cvdata').insertOne({
      cvMetadataId,
      sections,
      updatedAt: new Date()
    });

    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to insert cvdata', detail: err.message }));
  }
}
