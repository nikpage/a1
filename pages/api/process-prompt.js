import { analyzeCvJob, generateCV, generateCoverLetter } from '../../utils/openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { cv, job, tone, type } = req.body;

    if (!cv || !tone || !type) {
      return res.status(400).json({ error: 'Request body must include cv, tone, and type.' });
    }

    const analysisResult = await analyzeCvJob(cv, job || '');
    const analysisObject = JSON.parse(analysisResult.output);

    let finalContent;

    if (type === 'cv') {
      const result = await generateCV({
        cv: cv,
        analysis: analysisObject,
        tone: tone
      });
      finalContent = result.content;

    } else if (type === 'cover_letter') {
      const result = await generateCoverLetter({
        cv: cv,
        analysis: analysisObject,
        tone: tone
      });
      finalContent = result.content;

    } else {
      return res.status(400).json({ error: "Invalid 'type'. Use 'cv' or 'cover_letter'." });
    }

    return res.status(200).json({ content: finalContent });

  } catch (error) {
    console.error(`Error in /api/process-prompt:`, error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
