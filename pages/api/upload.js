// pages/api/upload.js
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { extractMetadata } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { file, userId } = req.body;

    if (!userId || !file?.content || !file?.name) {
      return res.status(400).json({ error: 'Missing file or userId' });
    }

    const buf = Buffer.from(file.content, 'base64');

    // extract raw text
    let rawText = '';
    if (file.name.toLowerCase().endsWith('.pdf')) {
      rawText = (await pdf(buf)).text;
      console.log('📝 Extracted raw text (preview):', rawText.slice(0, 1000));
    } else if (/\.(docx|doc)$/i.test(file.name)) {
      rawText = (await mammoth.extractRawText({ buffer: buf })).value;
      console.log('📝 Extracted raw text (preview):', rawText.slice(0, 1000));
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // call AI to get JSON metadata string
    let content = '';
try {
  const dsResponse = await extractMetadata(rawText);
  content = dsResponse?.choices?.[0]?.message?.content || '';
  console.log('🧠 Raw AI response:', content);
} catch (e) {
  console.error('❌ extractMetadata failed:', e);
  return res.status(500).json({ error: 'Metadata extraction failed' });
}


    // strip code fences if present
    content = content
      .replace(/^\s*```json\s*/i, '')
      .replace(/```$/g, '')
      .trim();

    // attempt parse with fallback
    let metadata = {};
    try {
      console.log('📄 Content to parse:', content);

      metadata = JSON.parse(content);
    } catch (parseErr) {
      console.error('Upload handler JSON parse error:', parseErr.message);
      console.error('Raw AI output was:', content);
      return res.status(200).json({ metadata: {}, parseError: true });
    }

    // Save to document_inputs
    const { error: insertErr } = await supabase
      .from('document_inputs')
      .upsert([
        {
          user_id: userId,
          type: 'cv',
          source: 'upload',
          raw_text: rawText,
          content: {
            text: rawText,
            cv: metadata,
          },
        },
      ]);

    if (insertErr) {
      console.error('Supabase insert error:', insertErr.message);
      return res.status(500).json({
        error: 'Failed to save parsed CV',
        details: insertErr.message,
      });
    }
    // After successful insert to document_inputs:
    const saveRes = await fetch('http://localhost:3000/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        data: metadata,
      }),
    });

    const saveJson = await saveRes.json();

    return res.status(200).json({ metadata, rawText });
  } catch (err) {
    console.error('Upload handler unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
