// pages/api/voice-profile.js
//
// The user's VOICE PROFILE — how they actually write, extracted from samples of
// their own writing and then reviewed and edited by them.
//
// Two actions, one route:
//   extract — the samples → one AI call → the register of each sample read off
//             the text, List A, List B(+translations) → saved, and returned for
//             review. The user is never asked to classify their own writing.
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
import { getVoiceProfile, saveVoiceProfile, deleteVoiceProfile } from '../../utils/database';
import { withAiContext } from '../../utils/ai-meter';
import { buildVoiceProfile } from '../../utils/openai';
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
    samples.push({ text });
  }
  if (!samples.length) return { error: 'Paste at least one sample of your own writing' };
  return { samples };
}

// The stored profile shape, assembled defensively. Anything the client sends that
// isn't part of the shape is dropped rather than written into the column.
function cleanProfile({ registers, list_a, list_b, confidence, profile_text, options, samples }) {
  return {
    // What the extraction read each sample as. Shown back to the user, and the
    // reason no label buttons exist: the writing says what it is.
    registers: (Array.isArray(registers) ? registers : []).map((r) => ({
      sample: Number(r?.sample) || 0,
      register: String(r?.register || '').trim(),
      distance: String(r?.distance || '').trim(),
    })).filter((r) => r.register),
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
      text: String(s?.text || '').trim().slice(0, MAX_SAMPLE_CHARS),
    })),
    updated_at: new Date().toISOString(),
  };
}

// Which of the STORED samples a save keeps. Removal is the only edit allowed:
// every returned sample is one the stored row already held, matched on its text.
//
// Two cases are deliberately not removals. An omitted `samples` key is an old or
// partial client that never had them — it keeps everything. A non-empty list
// that matches NOTHING stored is a stale or forged page rather than someone
// deleting their writing, so it keeps everything too. An explicit empty array is
// a real removal: the user cleared every box.
function keptSamples(incoming, stored) {
  const kept = Array.isArray(stored) ? stored : [];
  if (!Array.isArray(incoming)) return kept;
  if (!incoming.length) return [];
  const wanted = new Set(incoming.map((s) => String(s?.text || '').trim()).filter(Boolean));
  const survivors = kept.filter((s) => wanted.has(String(s?.text || '').trim()));
  return survivors.length ? survivors : kept;
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

    // The extraction call was recorded by the meter the moment it responded —
    // before this route could fail on the way to the save.
    const gu = built.gemini_usage;

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

    // The registers are not editable here — they are what the extraction READ
    // off the samples, not something the user sets.
    //
    // Samples: REMOVABLE but not REWRITABLE. Those are different powers and
    // conflating them broke one or the other. Refusing every incoming array made
    // the panel's Remove button a lie — the user cleared every box, pressed Save,
    // and watched them all come back. Accepting any incoming array would let a
    // client substitute sample text, which the letter quotes verbatim as its
    // rhythm reference. So a save may only DROP samples the stored row already
    // holds; text that is not already stored is ignored.
    const profile = cleanProfile({
      ...incoming,
      registers: existing?.registers || [],
      samples: keptSamples(incoming.samples, existing?.samples),
    });

    try {
      await saveVoiceProfile(user_id, profile);
    } catch (e) {
      logger.error('voice-profile: save failed:', e.message);
      return res.status(500).json({ error: 'Could not save your voice profile' });
    }

    return res.status(200).json({ ok: true, profile });
  }

  // Delete the whole profile. Without this there is no way back to a blank
  // slate: the sample boxes reload from the stored row every time the profile
  // arrives, so a profile the user wants rid of follows them into every later
  // attempt. No AI call, and the cover letter simply falls back to no voice.
  if (action === 'delete') {
    let cleared;
    try {
      cleared = await deleteVoiceProfile(user_id);
    } catch (e) {
      logger.error('voice-profile: delete failed:', e.message);
      return res.status(500).json({ error: 'Could not delete your voice profile' });
    }
    if (!cleared) return res.status(404).json({ error: 'There is no voice profile to delete' });
    return res.status(200).json({ ok: true, profile: null });
  }

  return res.status(400).json({ error: 'Unknown action' });
}

export default requireAuth(withAiContext('api:voice-profile', handler));
