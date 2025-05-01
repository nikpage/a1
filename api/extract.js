import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resume, jobAd } = req.body;

  if (!resume || !jobAd) {
    return res.status(400).json({ error: 'Missing resume or job ad' });
  }

  const prompt = `Analyze the following job ad and resume. Extract required skills, experience, and match them.

Resume:
${resume}

Job Advertisement:
${jobAd}`;

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a professional HR assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    });

    const aiText = response.data.choices[0].message.content;
    res.status(200).json({ extracted: aiText });
  } catch (error) {
    console.error('Error extracting information:', error);
    res.status(500).json({ error: 'Failed to extract information' });
  }
}
