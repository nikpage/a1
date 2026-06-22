// pages/api/download-token-check.js
import { consumeDownloadCredit } from '../../utils/database';
import { supabase } from '../../utils/database';
import { LIMITS } from '../../config/limits';
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

  // Spend a free download first (card-on-file grant), otherwise a paid token.
  let credit;
  try {
    credit = await consumeDownloadCredit(user_id);
  } catch {
    return res.status(500).json({ error: 'Database update failed.' });
  }

  if (credit === 'none') {
    return res.status(402).json({ error: 'INSUFFICIENT_TOKENS' });
  }

  try {
    // Refill the free generation allowance on every successful download.
    await supabase
      .from('users')
      .update({ generations_left: LIMITS.FREE_GENERATIONS })
      .eq('user_id', user_id);
  } catch {
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
  } catch {
    return res.status(500).json({ error: 'File generation failed.' });
  }
}

export default requireAuth(handler);
