// pages/api/download-token-check.js
import { getUser, decrementToken } from '../../utils/database';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import requireAuth from '../../lib/requireAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!req.user || !req.user.user_id) {
    return res.status(401).json({ error: 'Critical: Session is invalid or user data is missing.' });
  }

  const { user_id } = req.user;
  const { type, content } = req.body;

  if (!type || !content) {
    return res.status(400).json({ error: 'Missing required fields: type or content.' });
  }

  let user;
  try {
    user = await getUser(user_id);
  } catch (initialError) {
    console.error('Initial getUser failed:', initialError);
    return res.status(500).json({ error: 'Failed to retrieve user data.' });
  }

  if (!user || user.tokens < 1) {
    return res.status(402).json({ error: 'INSUFFICIENT_TOKENS' });
  }

  try {
    await decrementToken(user_id);
  } catch (dbError) {
    console.error('DATABASE ERROR during token decrement:', dbError);
    return res.status(500).json({ error: 'Database update failed.' });
  }

  try {
    const doc = new Document({
      sections: [
        {
          children: [new Paragraph({ children: [new TextRun(content)] })],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${type === 'cv' ? 'CV' : 'CoverLetter'}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (docError) {
    console.error('DOCX GENERATION ERROR:', docError);
    return res.status(500).json({ error: 'File generation failed.' });
  }
}

export default requireAuth(handler);
