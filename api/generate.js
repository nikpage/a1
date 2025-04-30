// generate.js
import { supabase } from './_supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fileContent, jobDetails, tone, language, docType } = req.body;
  if (!fileContent || !jobDetails || !tone || !language || !docType) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const prompt = `
Create a ${docType} in ${language} with a ${tone} tone.
Resume Content: ${fileContent}
Target Job Title: ${jobDetails.title}
Company: ${jobDetails.company}
Hiring Manager: ${jobDetails.hiringManager}
Keywords: ${jobDetails.keywords.join(', ')}
    `;

    const deepseekRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await deepseekRes.json();
    const generated = data.choices[0].message.content;

    // Update Supabase stats
    if (docType === 'CV') {
      await supabase.from('stats').update({ cv_count: supabase.raw('cv_count + 1') }).eq('id', 1);
    } else if (docType === 'Cover') {
      await supabase.from('stats').update({ cover_count: supabase.raw('cover_count + 1') }).eq('id', 1);
    }

    const toneField = tone.toLowerCase();
    if (['formal', 'neutral', 'casual', 'cocky'].includes(toneField)) {
      await supabase.from('stats').update({ [`tone_${toneField}`]: supabase.raw(`tone_${toneField} + 1`) }).eq('id', 1);
    }

    res.status(200).json({ result: generated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate document' });
  }
}
