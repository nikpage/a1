export default async function handler(req, res) {
  console.log('--- Request Start ---');
  console.log('Method:', req.method);
  console.log('Body:', req.body);

  if (req.method !== 'POST') {
    console.error('Method not allowed. Expected POST.');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, analysis, tone = 'Formal', type = 'both' } = req.body;
  console.log('User ID:', user_id);
  console.log('Type:', type);

  if (!user_id || !analysis || !type) {
    console.error('Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let user = await getUserById(user_id);
    console.log('User fetched:', user);

    const cost = type === 'both' ? 2 : 1;
    if (user.generations_left < cost) {
      console.error('Not enough generations left:', user.generations_left);
      return res.status(403).json({ error: 'Not enough generations left' });
    }
  } catch (err) {
    console.error('Error occurred', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
