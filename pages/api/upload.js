// pages/api/upload.js
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { extractMetadata } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

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
      return res.status(400).json({ error: 'Missing userId or file' });
    }

    // Check user exists
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userErr || !user) {
      console.error('User not found:', userErr);
      return res.status(400).json({ error: 'User not found' });
    }

    // Extract text
    const buf = Buffer.from(file.content, 'base64');
    let rawText = '';
    if (file.name.toLowerCase().endsWith('.pdf')) {
      const data = await pdf(buf);
      rawText = data.text;
    } else if (/\.(docx|doc)$/i.test(file.name)) {
      const result = await mammoth.extractRawText({ buffer: buf });
      rawText = result.value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Extract metadata
    let content = '';
    try {
      const dsResponse = await extractMetadata(rawText);
      content = dsResponse?.choices?.[0]?.message?.content || '';
    } catch (e) {
      console.error('extractMetadata failed:', e.message);
    }

    content = content.replace(/^\s*```json\s*/i, '').replace(/```$/g, '').trim();
    const safeContent = fixBrokenUnicodeEscapes(content);

    let metadata = {};
    try {
      metadata = JSON.parse(safeContent);
    } catch (e) {
      console.error('JSON parse error:', e.message);
    }

    const safeRawText = fixBrokenUnicodeEscapes(rawText);

    // Save document input
    const { data: insertedDoc, error: insertErr } = await supabase
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
      ])
      .select()
      .single();

    if (insertErr) {
      console.error('Supabase insert error:', insertErr.message);
      return res.status(500).json({ error: 'Failed to save data' });
    }

    return res.status(200).json({
      metadata,
      rawText: safeRawText,
      document_input_id: insertedDoc.id
    });
  } catch (e) {
    console.error('Unexpected error:', e.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
