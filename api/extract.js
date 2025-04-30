// extract.js
import { supabase } from './_supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'Missing input' });

  try {
    const deepseekRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Extract JSON with fields: title, company, hiringManager, keywords (array of 6).' },
          { role: 'user', content: input }
        ]
      })
    });

    const data = await deepseekRes.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    // Update Supabase extract count
    await supabase.from('stats').update({ extract_count: supabase.raw('extract_count + 1') }).eq('id', 1);

    res.status(200).json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to extract job details' });
  }
}
