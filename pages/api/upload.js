// pages/api/upload.js
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { extractMetadata } from '../../lib/deepseekClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { file } = req.body;
    const buf = Buffer.from(file.content, 'base64');

    // extract raw text
    let rawText = '';
    if (file.name.toLowerCase().endsWith('.pdf')) {
      rawText = (await pdf(buf)).text;
    } else if (/\.(docx|doc)$/i.test(file.name)) {
      rawText = (await mammoth.extractRawText({ buffer: buf })).value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // call AI to get JSON metadata string
    const dsResponse = await extractMetadata(rawText);
    console.log('🧠 DeepSeek message content:', dsResponse.choices?.[0]?.message?.content);

    let content = dsResponse?.choices?.[0]?.message?.content || '';

    // strip code fences if present
    content = content
      .replace(/^\s*```json\s*/i, '')
      .replace(/```$/g, '')
      .trim();

    // attempt parse with fallback
    let metadata = {};
    try {
      metadata = JSON.parse(content);
    } catch (parseErr) {
      console.error('Upload handler JSON parse error:', parseErr.message);
      console.error('Raw AI output was:', content);
      // return an empty object + error flag, so frontend can recover
      return res.status(200).json({ metadata: {}, parseError: true });
    }

    // success
    return res.status(200).json({ metadata });

  } catch (err) {
    console.error('Upload handler unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
