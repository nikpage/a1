// pages/api/voice-profile.js
//
// The user's VOICE PROFILE — how they actually write, extracted from samples of
// their own writing and then reviewed and edited by them.
//
// Two actions, one route:
//   extract — samples (each with the user's label for what it is) → one AI call
//             → List A / List B(+translations) → saved, and returned for review.
//   save    — the profile the user edited by hand. No AI call. Their edits are
//             authoritative: they know how they write better than a model reading
//             four samples does.
//
// Guards:
//   1. user_id comes from the verified session, never the body.
//   2. The CV is not an acceptable sample and cannot be smuggled in as one — a
//      sample is text the user pasted here, and bullet fragments carry no voice.
//   3. The AI call is cost-logged whether or not the result is kept (the user
//      was charged for it either way).

import requireAuth from '../../lib/requireAuth';
import { getVoiceProfile, saveVoiceProfile, logAiTransaction } from '../../utils/database';
import { buildVoiceProfile } from '../../utils/openai';
import { SAMPLE_LABELS } from '../../prompts/voice-profile';
import { logger } from '../../lib/logger';

// A sample thin enough to carry no pattern is worse than no sample: it produces
// confident observations from three sentences. The spec asks for 300+ words;
// this is the floor below which we refuse rather than the target.
const MIN_SAMPLE_CHARS = 400;
const MAX_SAMPLE_CHARS = 20000;
const MAX_SAMPLES = 4;
const MAX_PROFILE_TEXT = 4000;

function cleanSamples(input) {
  if (!Array.isArray(input)) return { error: 'Samples must be a list' };
  const samples = [];
  for (const s of input.slice(0, MAX_SAMPLES)) {
    const text = typeof s?.text === 'string' ? s.text.trim() : '';
    if (!text) continue;
    if (text.length < MIN_SAMPLE_CHARS) {
      return { error: `Each sample needs about 300 words. One is only ${text.length} characters.` };
    }
    if (text.length > MAX_SAMPLE_CHARS) {
      return { error: 'One of those samples is too long — trim it to a few pages.' };
    }
    const label = Object.prototype.hasOwnProperty.call(SAMPLE_LABELS, s?.label) ? s.label : 'other';
    samples.push({ label, text });
  }
  if (!samples.length) return { error: 'Paste at least one sample of your own writing' };
  return { samples };
}

// The stored profile shape, assembled defensively. Anything the client sends that
// isn't part of the shape is dropped rather than written into the column.
function cleanProfile({ list_a, list_b, confidence, profile_text, options, samples }) {
  return {
    list_a: (Array.isArray(list_a) ? list_a : []).map((o) => String(o || '').trim()).filter(Boolean),
    list_b: (Array.isArray(list_b) ? list_b : [])
      .map((b) => ({
        trait: String(b?.trait || '').trim(),
        translation: String(b?.translation || '').trim(),
      }))
      // A trait with no translation is dropped: an untranslated register-bound
      // habit must never reach a generator. That split is the whole design.
      .filter((b) => b.trait && b.translation),
    confidence: String(confidence || '').trim(),
    profile_text: String(profile_text || '').trim().slice(0, MAX_PROFILE_TEXT),
    options: { cleanup: options?.cleanup === true },
    samples: (Array.isArray(samples) ? samples : []).slice(0, MAX_SAMPLES).map((s) => ({
      label: Object.prototype.hasOwnProperty.call(SAMPLE_LABELS, s?.label) ? s.label : 'other',
      text: String(s?.text || '').trim().slice(0, MAX_SAMPLE_CHARS),
    })),
    updated_at: new Date().toISOString(),
  };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.user;
  const action = req.body?.action;

  if (action === 'extract') {
    const { samples, error } = cleanSamples(req.body?.samples);
    if (error) return res.status(400).json({ error });

    let built;
    try {
      built = await buildVoiceProfile(samples);
    } catch (e) {
      logger.error('voice-profile extract failed:', e.message);
      return res.status(502).json({ error: 'Could not read your writing — please try again' });
    }

    // Cost-logged before anything can fail on the way to the save: the call was
    // paid for whether or not the row lands.
    const gu = built.gemini_usage;
    try {
      await logAiTransaction({
        user_id,
        model: gu.model,
        cache_miss_tokens: gu.inputTokens,
        completion_tokens: gu.outputTokens + gu.thinkingTokens,
        thinking_tokens: gu.thinkingTokens,
        detail: { label: gu.label },
      });
    } catch (e) {
      logger.error('voice-profile: cost log failed:', e.message);
    }

    // Keep the user's own lines and options across a re-extract — they are
    // hand-written and no AI pass should be able to wipe them.
    let existing = null;
    try {
      existing = await getVoiceProfile(user_id);
    } catch (e) {
      logger.error('voice-profile: could not read existing profile:', e.message);
    }

    const profile = cleanProfile({
      ...built.profile,
      profile_text: existing?.profile_text || '',
      options: existing?.options,
      samples,
    });

    try {
      await saveVoiceProfile(user_id, profile);
    } catch (e) {
      logger.error('voice-profile: save failed:', e.message);
      return res.status(500).json({ error: 'Could not save your voice profile' });
    }

    return res.status(200).json({ ok: true, profile, gemini_usage: gu });
  }

  if (action === 'save') {
    const incoming = req.body?.profile;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ error: 'A profile is required' });
    }

    // The samples are not editable here — they are what the user pasted. Carried
    // from the stored row so a save can neither drop nor rewrite them.
    let existing = null;
    try {
      existing = await getVoiceProfile(user_id);
    } catch (e) {
      logger.error('voice-profile: could not read existing profile:', e.message);
    }

    const profile = cleanProfile({ ...incoming, samples: existing?.samples || [] });

    try {
      await saveVoiceProfile(user_id, profile);
    } catch (e) {
      logger.error('voice-profile: save failed:', e.message);
      return res.status(500).json({ error: 'Could not save your voice profile' });
    }

    return res.status(200).json({ ok: true, profile });
  }

  return res.status(400).json({ error: 'Unknown action' });
}

export default requireAuth(handler);
