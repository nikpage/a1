// pages/api/write-docs.js
import { buildCVPrompt, buildCoverLetterPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const { userId, metadata, coverLetterData, outputType = 'both' } = req.body;

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

    const cvPrompt = buildCVPrompt(metadata.tone, jobDetails);
    const clPrompt = buildCoverLetterPrompt(metadata.tone, coverData);

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
