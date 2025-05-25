// pages/api/write-docs.js
import { generate } from '../../lib/deepseekClient';

export default async function handler(req, res) {
   console.log('BODY:', req.body);
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { metadata, cv, tone = 'neutral', outputType = 'cv', language = 'en' } = req.body;

  if (!metadata || !cv || !tone || !outputType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('📩 INPUT:', { metadata, tone, outputType, language });

    const prompt = `
You are a CV assistant.

Based on the following metadata and parsed CV, generate a ${tone} ${outputType} in ${language}.

Metadata:
${JSON.stringify(metadata, null, 2)}

Parsed CV:
${cv}
`.trim();

    console.log('🧠 Prompt to DeepSeek:', prompt);

    const result = await generate(prompt);

    res.status(200).json({
      [outputType]: result.choices?.[0]?.message?.content || result,
      _usedKey: result._usedKey,
      _keyIndex: result._keyIndex,
    });
  } catch (err) {
    console.error('write-docs error:', err);
    res.status(500).json({
      error: 'Failed to generate content',
      details: err.message,
    });
  }
}
