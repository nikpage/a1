// /api/generate.js (fixed)

import { Configuration, OpenAIApi } from 'openai';

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(config);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send({ error: 'Method not allowed' });
    return;
  }

  const { resume, jobAd, tone, docType, lang } = req.body;

  if (!resume || !jobAd) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const prompt = `Create a ${docType} based on the following resume and job advertisement.
Tone: ${tone}
Language: ${lang}

Resume:
${resume}

Job Advertisement:
${jobAd}`;

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a professional career assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });

    const aiText = response.data.choices[0].message.content;
    res.status(200).json({ text: aiText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate document' });
  }
}
