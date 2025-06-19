// pages/api/generate-cv-cover.js
import { getCvData } from '../../utils/database';
import { generateDocuments } from '../../utils/openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, analysis, tone = 'Formal', type = 'both' } = req.body;
  if (!user_id || !analysis || !type) return res.status(400).json({ error: 'Missing required fields' });

  let cv_data;
  try {
    cv_data = await getCvData(user_id);
    if (!cv_data) return res.status(404).json({ error: 'CV not found for user' });
  } catch {
    return res.status(500).json({ error: 'Error fetching CV data' });
  }

  let docs;
  try {
    docs = await generateDocuments({ cv: cv_data, analysis, tone, type });
  } catch (err) {
    console.error('Generation error:', err);
    return res.status(500).json({ error: 'Document generation failed' });
  }

  res.status(200).json({ docs });
}
