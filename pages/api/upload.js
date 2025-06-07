// pages/api/upload.js
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { extractMetadata } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

// Helper to fix broken \u escapes
function fixBrokenUnicodeEscapes(str) {
  return str.replace(/\\u([0-9a-fA-F]{1,3})([^0-9a-fA-F]|$)/g, (match, hex, tail) => {
    const fixedHex = hex.padStart(4, '0');
    return `\\u${fixedHex}${tail}`;
  });
}

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

    let rawText = '';
    if (file.name.toLowerCase().endsWith('.pdf')) {
      rawText = (await pdf(buf)).text;
    } else if (/\.(docx|doc)$/i.test(file.name)) {
      rawText = (await mammoth.extractRawText({ buffer: buf })).value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    let content = '';
    try {
      const dsResponse = await extractMetadata(rawText);
      content = dsResponse?.choices?.[0]?.message?.content || '';
    } catch (e) {
      console.error('extractMetadata failed:', e);
      return res.status(500).json({ error: 'Metadata extraction failed' });
    }

    content = content
      .replace(/^\s*```json\s*/i, '')
      .replace(/```$/g, '')
      .trim();

    const safeContent = fixBrokenUnicodeEscapes(content);

    let metadata = {};
    try {
      metadata = JSON.parse(safeContent);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      return res.status(200).json({ metadata: {}, parseError: true });
    }

    // FIX: Also fix rawText before inserting
    const safeRawText = fixBrokenUnicodeEscapes(rawText);

    const { error: insertErr } = await supabase
      .from('document_inputs')
      .upsert([
        {
          user_id: userId,
          type: 'cv',
          source: 'upload',
          raw_text: safeRawText,
          content: {
            text: safeRawText,
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

    // Save CV data directly using Supabase instead of fetch
    const { error: saveError } = await supabase
      .from('cv_data')
      .insert({ user_id: userId, data: metadata });

    if (saveError) {
      console.error('Failed to save CV data:', saveError);
    }

    return res.status(200).json({ metadata, rawText: safeRawText });
  } catch (err) {
    console.error('Upload handler unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
