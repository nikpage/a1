import clientPromise from '../../../mongo.js';


export const config = {
  api: {
    bodyParser: false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { secretId } = req.query
  if (!secretId) {
    return res.status(400).json({ error: 'Missing secretId' })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const session = await db.collection('sessions').findOne({ secretId })
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    return res.status(200).json(session)
  } catch (err) {
    console.error('API /session error:', err)
    return res.status(500).json({ error: err.message })
  }
}
