// pages/api/download-token-check.js
import { getUser, decrementToken } from '../../utils/database';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import requireAuth from '../../lib/auth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Added security check to ensure user object is properly attached by middleware.
  if (!req.user || !req.user.user_id) {
    return res.status(401).json({ error: 'Critical: Session is invalid or user data is missing.' });
  }

  const { user_id } = req.user;
  const { type, content } = req.body;

  if (!type || !content) {
    return res.status(400).json({ error: 'Missing required fields: type or content.' });
  }

  try {
    const user = await getUser(user_id);
    if (!user || user.tokens < 1) {
      return res.status(402).json({ error: 'INSUFFICIENT_TOKENS' });
    }

    await decrementToken(user_id);

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

  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default requireAuth(handler);
