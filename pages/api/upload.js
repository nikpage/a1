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

    let rawText = '';
    if (file.name.toLowerCase().endsWith('.pdf')) {
      rawText = (await pdf(buf)).text;
    } else if (/\.(docx|doc)$/i.test(file.name)) {
      rawText = (await mammoth.extractRawText({ buffer: buf })).value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const dsResponse = await extractMetadata(rawText);

    let metadata = {};
    try {
      let content = dsResponse?.choices?.[0]?.message?.content || '';
      content = content.replace(/^\s*```json\s*/i, '').replace(/^\s*```\s*$/gm, '').replace(/```$/g, '').trim();
      metadata = JSON.parse(content);
    } catch (err) {
      console.error('Failed to parse metadata:', err, dsResponse?.choices?.[0]?.message?.content);
      metadata = {};
    }

    return res.status(200).json({ metadata });
  } catch (err) {
    console.error('Upload handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
