import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resume, jobAd, tone, docType, lang } = req.body;

  if (!resume || !jobAd) {
    return res.status(400).json({ error: 'Missing resume or job ad' });
  }

  const prompt = `Create a ${docType} document in ${lang} with a ${tone} tone, based on the following:
Resume:
${resume}

Job Ad:
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

    const content = response.data.choices[0].message.content;
    return res.status(200).json({ text: content });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to generate content.' });
  }
}
