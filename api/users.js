// api/user.js
import clientPromise from '../lib/mongo.js';

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('cvpro');
    const user = await db.collection('users').findOne({ token });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      userId: user._id,
      email: user.email
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
