// pages/api/upload-cv.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import pdfParse from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
  },
};

type ResponseData = {
  message: string;
  sessionToken?: string;
  publicUrl?: string;
  parsedCVText?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Create a new formidable form instance with the correct API
    const form = formidable();

    // Parse the form using Promise
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Get the file from the files object
    const fileArray = files.file;
    if (!fileArray || fileArray.length === 0) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = fileArray[0];
    const sessionToken = uuidv4();

    // Read the file and upload to Supabase
    const fileBuffer = fs.readFileSync(file.filepath);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cv-uploads')
      .upload(`${sessionToken}/${file.originalFilename}`, fileBuffer, {
        contentType: file.mimetype || 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    const { publicURL } = supabase.storage
      .from('cv-uploads')
      .getPublicUrl(`${sessionToken}/${file.originalFilename}`);

    const parsed = await pdfParse(fileBuffer);
    const parsedCVText = parsed.text || '';

    // Call DeepSeek via fetch
    const deepseekRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an expert resume parser.' },
          { role: 'user', content: parsedCVText },
        ],
      }),
    });

    if (!deepseekRes.ok) {
      console.error('DeepSeek API error:', await deepseekRes.text());
      return res.status(500).json({ error: 'DeepSeek parsing failed' });
    }

    const deepData = await deepseekRes.json();
    const parsedResult = deepData.choices?.[0]?.message?.content || '';

    return res.status(200).json({
      message: 'File uploaded, parsed, and CV data saved successfully',
      sessionToken,
      publicUrl: publicURL,
      parsedCVText: parsedResult,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
