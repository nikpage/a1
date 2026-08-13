// pages/api/update-voice-guide.js
//
// The one write path for `voice_guide` — the user's own statement of how they
// write, which both generators read for cadence, sentence shapes and vocabulary
// (prompts/cover-letter.js, prompts/cv-rules.js Layer 2).
//
// It needed its own route. The field is deliberately unreachable from every
// other write path: normaliseMaster lists it in PRESERVED_STRINGS so the master
// editor cannot overwrite it, the build/merge prompts only copy it through, and
// saveMasterCv re-attaches it whenever an incoming record doesn't mention it —
// all so no AI pass can invent or reword it. The consequence was that NOTHING
// could set it either, and the field sat permanently null while the cover letter
// fell back to voice_samples: sentences lifted verbatim from the uploaded CV,
// i.e. corporate CV prose. That is exactly the machine-sounding letter the guide
// exists to prevent.
//
// Guards:
//   1. user_id comes from the verified session, never the body.
//   2. The body carries prose and nothing else — no route through here can touch
//      any other field of the master record.
//   3. An empty string is a deliberate CLEAR and is written as such (saveMasterCv
//      distinguishes the key being absent from its value being empty).

import requireAuth from '../../lib/requireAuth';
import { getMasterCv, saveMasterCv } from '../../utils/database';
import { logger } from '../../lib/logger';

// Long enough for a few paragraphs of real writing, bounded so a runaway paste
// cannot bloat every generation prompt from here on.
const MAX_LENGTH = 4000;

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.user;
  const raw = req.body?.voice_guide;

  // Prose only. An object coerces to "[object Object]" — truthy, survives every
  // filter, and would replace the guide with a placeholder.
  if (raw != null && typeof raw !== 'string') {
    return res.status(400).json({ error: 'Your writing guide must be text' });
  }
  const voice_guide = String(raw ?? '').trim();
  if (voice_guide.length > MAX_LENGTH) {
    return res.status(400).json({ error: `Please keep it under ${MAX_LENGTH} characters` });
  }

  let stored;
  try {
    stored = await getMasterCv(user_id);
  } catch (e) {
    logger.error('update-voice-guide: load failed:', e.message);
    return res.status(500).json({ error: 'Could not load your record' });
  }
  // The guide lives on the master record, so there must be one to write it to.
  if (!stored) {
    return res.status(409).json({ error: 'No master record yet — upload a CV first' });
  }

  const updated = { ...stored, voice_guide };

  try {
    await saveMasterCv(user_id, updated);
  } catch (e) {
    logger.error('update-voice-guide: save failed:', e.message);
    return res.status(500).json({ error: 'Could not save your writing guide' });
  }

  return res.status(200).json({ ok: true, master: updated });
}

export default requireAuth(handler);
