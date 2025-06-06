// pages/api/extract-job-meta.js
import { supabase } from '../../lib/supabase';
import { buildExtractionPrompt } from '../../lib/prompt-builder.js';
import { generate } from '../../lib/deepseekClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, userId } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'No job description provided' });
  }
  if (!userId || typeof userId !== 'string' || userId.length !== 36) {
    return res.status(400).json({ error: 'Invalid or missing userId' });
  }

  try {
    let { data, error } = await supabase
      .from('cv_metadata')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('No CV metadata found for the user.');
    }

    data = [{ raw_text: JSON.stringify(data.data) }];

    if (!data || !data[0]?.raw_text) {
      const { data: cvMetaData, error: cvMetaError } = await supabase
        .from('cv_metadata')
        .select('data')
        .eq('user_id', userId)
        .single();

      if (cvMetaError || !cvMetaData || !cvMetaData.data) {
        throw new Error('No CV data found for the user.');
      }

      data = [{ raw_text: JSON.stringify(cvMetaData.data) }];
    }

    let cvText = '';
    let cvKeywords = [];

    cvText = data[0].raw_text;
    try {
      const cvData = JSON.parse(cvText);
      ['skills', 'primary_skills', 'industries'].forEach((field) => {
        if (Array.isArray(cvData[field])) {
          cvKeywords = cvKeywords.concat(cvData[field].map((kw) => kw.trim()));
        }
      });
      cvKeywords = [...new Set(cvKeywords)];
    } catch (err) {}

    const prompt = buildExtractionPrompt(cvText, cvKeywords, text);

    const raw = await generate(prompt);
    console.log('🔍 RAW DEEPSEEK RESPONSE:', JSON.stringify(raw, null, 2));

    let content = raw?.choices?.[0]?.message?.content || raw?.content || raw?.response || raw || '{}';

    content = content.trim();
    content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    content = content.trim();
    console.log('🔍 CLEANED CONTENT:', content.slice(0, 200));


    let metadata;
    try {
      metadata = JSON.parse(content);
    } catch (jsonError) {
      return res.status(200).json({
        error: 'Invalid JSON response from DeepSeek',
        preview: content.slice(0, 300),
        fallback: {}
      });
    }

    console.log('🔍 FINAL RESPONSE:', metadata);
    res.status(200).json(metadata);


  } catch (error) {
    return res.status(500).json({
      error: 'Failed to parse job metadata',
      details: error.message
    });
  }
}
