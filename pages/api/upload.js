// pages/api/upload.js
export const config = {
  runtime: 'nodejs',
};

import pdfParse from 'pdf-parse';
import { generate } from '../../lib/deepseekClient';
import { buildCVMetadataExtractionPrompt } from '../../lib/prompt-builder';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  try {
    const { userId, file } = req.body;
    if (!userId || !file?.content || !file?.name) {
      return res.status(400).json({ error: 'Missing file or user info' });
    }

    const buffer = Buffer.from(file.content, 'base64');
    const pdf = await pdfParse(buffer);
    const text = pdf.text;

    const prompt = buildCVMetadataExtractionPrompt(text);
    const result = await generate(prompt);

    const content = result.choices?.[0]?.message?.content || '{}';
    const metadata = JSON.parse(content);

    res.status(200).json({ metadata });
  } catch (err) {
    console.error('UPLOAD ERROR:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
}
