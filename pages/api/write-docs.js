// pages/api/write-docs.js
import { generate } from '../../lib/deepseekClient';
import { buildCVPrompt, buildCoverLetterPrompt } from '../../lib/prompt-builder';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { userId, metadata, tone = 'neutral', outputType = 'cv', language = 'en' } = req.body;

  if (!userId || !metadata || !tone || !outputType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Fetch the most recent parsed CV
    const { data, error } = await supabase
      .from('document_inputs')
      .select('content')
      .eq('user_id', userId)
      .eq('type', 'cv')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No parsed CV found for user' });
    }

    const parsedCV = data.content;
    const jobDetails = {
      title: metadata?.title || metadata?.current_role || '',
      company: metadata?.company || metadata?.primary_company || '',
      hiringManager: metadata?.hiringManager || '',
      keywords: Array.isArray(metadata?.skills) ? metadata.skills.slice(0, 8) : [],
    };

    const userProfile =
      parsedCV?.summary || parsedCV?.body || JSON.stringify(parsedCV || {}, null, 2);

    let prompt = '';

    if (outputType === 'cv') {
      prompt = buildCVPrompt(tone, jobDetails);
    } else if (outputType === 'cover') {
      prompt = buildCoverLetterPrompt(tone, jobDetails);
    } else {
      throw new Error('Invalid outputType');
    }

    prompt += `

------------------------
📄 CANDIDATE BACKGROUND:
${userProfile}
------------------------

Use only the actual background. Do NOT invent details.`;

    const result = await generate(prompt);

    res.status(200).json({
      [outputType]: result.choices?.[0]?.message?.content || result,
      _usedKey: result._usedKey,
      _keyIndex: result._keyIndex,
    });
  } catch (err) {
    console.error('write-docs error:', err);
    res.status(500).json({
      error: 'Failed to generate content',
      details: err.message,
    });
  }
}
