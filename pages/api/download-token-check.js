// pages/api/download-token-check.js

import { getCvData, getUser, decrementToken } from '../../utils/database';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, type, content } = req.body;
  if (!user_id || !type || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
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
