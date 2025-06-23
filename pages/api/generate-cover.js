// pages/api/generate-cover.js

import { getCV, saveGeneratedDoc } from '../../utils/database';
import { generateCoverLetter } from '../../utils/openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, jobText = '', tone = 'Formal' } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Missing required fields' });

  let cvRecord;
  try {
    cvRecord = await getCV(user_id);
    if (!cvRecord || !cvRecord.cv_data) return res.status(404).json({ error: 'CV not found for user' });
  } catch (e) {
    return res.status(500).json({ error: 'DB error' });
  }

  const jobTextFinal = jobText.trim()
    ? jobText
    : 'The candidate is seeking a leadership role in product, UX, or innovation. Write a tailored, compelling cover letter using only the CV.';

  let cover = null;
  try {
    cover = await generateCoverLetter({
      cv: cvRecord.cv_data,
      jobText: jobTextFinal,
      tone
    });

    await saveGeneratedDoc({
      user_id,
      source_cv_id: user_id,
      type: 'cover',
      tone,
      file_name: 'Generated_Cover_Letter.txt',
      content: cover
    });
  } catch (err) {
    return res.status(500).json({ error: 'Generation failed' });
  }

  return res.status(200).json({ cover });
}
