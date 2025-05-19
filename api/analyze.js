export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const apiKey = km.keys[0];
    console.log('[DeepSeek API] Using Key index:', km.currentKeyIndex);
    if (!apiKey) throw new Error('API key missing');

    const apiRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: buildCVMetadataExtractionPrompt(text) }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }

    const chatJson = await apiRes.json();
    let parsed;
    try {
      parsed = JSON.parse(chatJson.choices[0].message.content);
    } catch {
      throw new Error('Invalid JSON from DeepSeek');
    }

    // ✅ First respond with metadata to user
    res.status(200).json({ metadata: parsed });

    // ⬇️ Then do DB work async — non-blocking
    (async () => {
      const userId = crypto.randomUUID();

      const userRes = await fetch(
        'https://ybfvkdxeusgqdwbekcxm.supabase.co/rest/v1/users',
        {
          method: 'POST',
          headers: {
            apikey:        process.env.SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{ id: userId, email: null, secret: '' }])
        }
      );
      if (!userRes.ok) {
        console.error(`User insert error ${userRes.status}:`, await userRes.text());
        return;
      }

      const metaRes = await fetch(
        'https://ybfvkdxeusgqdwbekcxm.supabase.co/rest/v1/cv_metadata',
        {
          method: 'POST',
          headers: {
            apikey:        process.env.SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{ user_id: userId, data: parsed }])
        }
      );
      if (!metaRes.ok) {
        console.error(`Metadata insert error ${metaRes.status}:`, await metaRes.text());
      }
    })();

  } catch (err) {
    console.error('API analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}
