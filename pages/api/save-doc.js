// pages/api/save-doc.js
//
// The user's own edits to a generated CV or cover letter, saved before download.
// No AI, no tokens: hand-editing a document is not a generation, so it never
// touches the free-write allowance and never spends a download token.
//
// Persistence goes through the SAME path the generator and the headline edit use
// (saveGeneratedDoc → a new gen_data row, which get-docs then reads back), so an
// edited document survives a refresh exactly like a generated one.

import { logger } from '../../lib/logger';
import { saveGeneratedDoc } from '../../utils/database';
import requireAuth from '../../lib/requireAuth';

const FILE_NAMES = {
  cv: 'Generated_CV.txt',
  cover: 'Generated_Cover_Letter.txt',
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user_id = req.user.user_id;
  const { type, content, tone = 'Formal' } = req.body;

  if (!FILE_NAMES[type]) {
    return res.status(400).json({ error: 'Unknown document type' });
  }
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Missing document content' });
  }

  try {
    await saveGeneratedDoc({
      user_id,
      source_cv_id: user_id,
      type,
      tone,
      file_name: FILE_NAMES[type],
      content,
    });
  } catch (err) {
    logger.error('Document save error:', err.message);
    return res.status(500).json({ error: 'Could not save the document' });
  }

  return res.status(200).json({ content });
}

export default requireAuth(handler);
