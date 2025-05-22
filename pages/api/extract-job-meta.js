// pages/api/extract-job-meta.js
import { buildExtractionPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No job description provided' });
  }

  try {
    // Build the prompt for DeepSeek
    const prompt = buildExtractionPrompt(text);

    // Send prompt to DeepSeek API and get raw response
    const raw = await generate(prompt);
  const content = raw?.choices?.[0]?.message?.content || '{}';
  const metadata = JSON.parse(content);


    // Enforce max 8 keywords if present
    if (Array.isArray(metadata.keywords)) {
      metadata.keywords = metadata.keywords.slice(0, 8);
    }

    // Return the structured metadata
    return res.status(200).json(metadata);
  } catch (error) {
    console.error('extract-job-meta error:', error);
    return res.status(500).json({ error: error.message });
  }
}
