import { getCvData, getCV, saveGeneratedDoc } from '../../utils/database';
import { generateCV, generateCoverLetter } from '../../utils/openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Body received:', req.body);
  const { user_id, analysis, tone = 'Formal', type = 'both' } = req.body;
  if (!user_id || !analysis || !type) {
    console.log('Missing field:', { user_id, analysis, type });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let cvRecord;
  try {
    cvRecord = await getCV(user_id);
    console.log('Fetched CV data:', !!cvRecord);
    if (!cvRecord || !cvRecord.cv_data) {
      return res.status(404).json({ error: 'CV not found for user' });
    }
  } catch (dbErr) {
    console.error('Error fetching CV data:', dbErr);
    return res.status(500).json({ error: 'Error fetching CV data' });
  }

  let cv = null;
  let cover = null;

  try {
    console.log('Generating documents for type:', type);
    if (type === 'cv') {
      cv = await generateCV({ cv: cvRecord.cv_data, analysis, tone });
      await saveGeneratedDoc({
        user_id,
        source_cv_id: user_id,
        type: 'cv',
        tone,
        file_name: 'Generated_CV.txt',
        content: cv
      });
    } else if (type === 'cover') {
      cover = await generateCoverLetter({ cv: cvRecord.cv_data, analysis, tone });
      await saveGeneratedDoc({
        user_id,
        source_cv_id: user_id,
        type: 'cover',
        tone,
        file_name: 'Generated_Cover_Letter.txt',
        content: cover
      });
    } else if (type === 'both') {
      cv = await generateCV({ cv: cvRecord.cv_data, analysis, tone });
      cover = await generateCoverLetter({ cv: cvRecord.cv_data, analysis, tone });
      await saveGeneratedDoc({
        user_id,
        source_cv_id: user_id,
        type: 'cv',
        tone,
        file_name: 'Generated_CV.txt',
        content: cv
      });
      await saveGeneratedDoc({
        user_id,
        source_cv_id: user_id,
        type: 'cover',
        tone,
        file_name: 'Generated_Cover_Letter.txt',
        content: cover
      });
    } else {
      console.log('Invalid type:', type);
      return res.status(400).json({ error: 'Invalid type specified' });
    }
  } catch (err) {
    console.error('Generation or saving error:', err);
    return res.status(500).json({ error: 'Document generation or saving failed' });
  }

  console.log('Generation success, returning:', { cv: !!cv, cover: !!cover });
  return res.status(200).json({ cv, cover });
}
