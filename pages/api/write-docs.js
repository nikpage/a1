import { buildCVPrompt, buildCoverLetterPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { userId, metadata, coverLetterData, outputType = 'both', tone = 'neutral' } = req.body;

    const { data: inputDoc, error: inputError } = await supabase
      .from('document_inputs')
      .select('raw_text')
      .eq('user_id', userId)
      .eq('type', 'cv')
      .limit(1)
      .single();

    const raw = inputDoc?.raw_text;
    const cvText = typeof raw === 'string' ? raw : (raw ? String(raw) : '');

    // 🔍 Log core values
    console.log('📦 userId:', userId);
    console.log('📦 outputType:', outputType);
    console.log('📦 inputDoc:', inputDoc);
    console.log('📦 cvText:', cvText);

    const jobDetails = {
      title: metadata?.jobDetails?.title || '',
      company: metadata?.jobDetails?.company || '',
      keywords: Array.isArray(metadata?.jobDetails?.keywords) ? metadata.jobDetails.keywords : [],
    };

    const coverData = {
      title: coverLetterData?.title || '',
      company: coverLetterData?.company || '',
      hiringManager: coverLetterData?.hiringManager || '',
      keywords: Array.isArray(coverLetterData?.keywords) ? coverLetterData.keywords : [],
    };

    const cvPrompt = buildCVPrompt(tone, jobDetails, cvText);
const clPrompt = buildCoverLetterPrompt(tone, coverData, cvText);

    console.log('🧠 FINAL CV PROMPT START >>>\n', cvPrompt, '\n<<< END');

    console.log('✉️ FINAL CL PROMPT START >>>\n', clPrompt, '\n<<< END');

    const [cvResult, clResult] = await Promise.all([
      generate(cvPrompt),
      generate(clPrompt),
    ]);

    return res.status(200).json({
      cv: cvResult,
      coverLetter: clResult,
    });
  } catch (err) {
    console.error('🚨 WRITE-DOCS ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}
