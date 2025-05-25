// pages/api/upload.js
export const config = {
  runtime: 'nodejs',
};

import { supabase } from '../../lib/supabase';
import { buildCVMetadataExtractionPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';
import pdfParse from 'pdf-parse';

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

    const base64 = file.content;
    const buffer = Buffer.from(base64, 'base64');

    // PDF text extraction
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    const prompt = buildCVMetadataExtractionPrompt(text);
    const result = await generate(prompt);

    const metadata = result.choices?.[0]?.message?.content
      ? JSON.parse(result.choices[0].message.content)
      : result;

    res.status(200).json({ metadata });
  } catch (err) {
    console.error('upload error:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
}
