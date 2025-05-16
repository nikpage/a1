// scripts/seed.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('cvpro');

    const users = db.collection('users');
    const parsedcv = db.collection('parsedcv');
    const metadata = db.collection('metadata');
    const feedback = db.collection('feedback');

    const user = {
      email: 'test@example.com',
      password: 'test123',
      token: 'secret-token-xyz',
      createdAt: new Date()
    };
    const userResult = await users.insertOne(user);

    const parsed = {
      userId: userResult.insertedId,
      fileName: 'cv_test.pdf',
      content: 'Parsed content goes here...',
      uploadedAt: new Date()
    };
    const parsedResult = await parsedcv.insertOne(parsed);

    const meta = {
      userId: userResult.insertedId,
      parsedId: parsedResult.insertedId,
      data: { position: 'Engineer', skills: ['JS', 'Node'] },
      submittedAt: new Date()
    };
    const metaResult = await metadata.insertOne(meta);

    const fb = {
      userId: userResult.insertedId,
      metadataId: metaResult.insertedId,
      summary: 'Looks good overall.',
      suggestions: ['Add more projects'],
      score: 85,
      createdAt: new Date()
    };
    await feedback.insertOne(fb);

    console.log('✅ Seed data inserted');
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
