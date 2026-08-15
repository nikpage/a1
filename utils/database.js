// utils/database.js

import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';
import { masterForPrompt } from './master-read.js';

let _supabase;
function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return _supabase;
}
export const supabase = new Proxy({}, { get: (_, prop) => getSupabase()[prop] });

let _adminSupabase;
function getAdminSupabase() {
  if (!_adminSupabase) _adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _adminSupabase;
}

// Upsert user
// Ensure a users row exists for `user_id`, WITHOUT destroying what is already
// on it. An upsert sends every column in the payload, so passing an omitted
// field as null overwrites the stored value with null — that is how a CV upload
// used to wipe the signed-in user's email off their account. Only fields the
// caller actually supplied are written; the rest are left untouched.
export async function upsertUser(user_id, phone_hash = null, email = null) {
    const row = { user_id };
    if (phone_hash != null) row.phone_hash = phone_hash;
    if (email != null) row.email = String(email).toLowerCase().trim();

    const { data, error } = await getAdminSupabase()
        .from('users')
        .upsert([row], { onConflict: 'user_id' })
        .select();
    if (error) {
        logger.error('UpsertUser error:', error.message, error.details);
        throw new Error(`UpsertUser failed: ${error.message}`);
    }
    logger.info('User upserted:', user_id);
    return data;
}

// Upsert CV
// Upsert the extracted CV text. A new upload is a NEW CV, so the stored master
// is stale — null it here so the next analysis rebuilds it from this CV (one CV,
// one profile). Without this the master is built once and reused forever, so any
// later improvement to the build never reaches an existing user.
export async function upsertCV(user_id, cv_data) {
  const { data, error } = await supabase
    .from('cv_data')
    .upsert([{ user_id, cv_data, master_cv: null }], { onConflict: ['user_id'] });
  if (error) throw new Error(`UpsertCV failed: ${error.message || JSON.stringify(error)}`);
  return data;
}

// Get CV (by user_id)
export async function getCV(user_id) {
  const { data, error } = await supabase
    .from('cv_data')
    .select('*')
    .eq('user_id', user_id)
    .single();
  if (error) throw error;
  return data;
}

// Read the per-user MASTER CV (the persisted source-of-truth). Returns the
// parsed object, or null if none has been built yet.
export async function getMasterCv(user_id) {
  const { data, error } = await supabase
    .from('cv_data')
    .select('master_cv')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.master_cv || null;
}

// The factual SOURCE every generation writes from: the MASTER CV, serialised.
// Falls back to the raw CV text only for users whose master hasn't been built
// (older accounts / a failed build). Returns null when the user has no CV at
// all. One definition, so every generation path reads the same source.
export async function getGenerationSource(user_id) {
  let cvRecord = null;
  try {
    cvRecord = await getCV(user_id);
  } catch (dbErr) {
    logger.error('CV fetch error:', dbErr.message);
    throw dbErr;
  }
  let master = null;
  try {
    master = await getMasterCv(user_id);
  } catch (masterErr) {
    logger.error('Master CV fetch error:', masterErr.message);
  }
  // Serialised through masterForPrompt so the user's own clarifications sit on
  // the roles they answered about — where prompts/cv-generator.js reads them.
  return master ? JSON.stringify(masterForPrompt(master)) : (cvRecord?.cv_data || null);
}

// Persist the per-user MASTER CV (service-role write). Stored as JSONB.
//
// Uses UPSERT on the user_id PK, not a bare `.update().eq()`. An update whose
// filter matches no row reports no error and writes nothing — the silent no-op
// that leaves master_cv null even though the build was paid for. Upsert instead
// guarantees a write: it updates the row when it exists and inserts it when it
// somehow doesn't. Only `user_id` + `master_cv` are sent, so an existing row's
// `cv_data` text and other columns are left untouched on the conflict update.
// We read the row back and throw if nothing came back, so a failed write can
// never again pass silently.
// `voice_guide` is the user's own cover-letter style guide: user-authored prose
// that no AI pass emits. A fresh build from a new CV upload therefore arrives
// without it, and a bare save would silently delete it. Carry the stored value
// forward whenever the incoming record doesn't MENTION one — this is the single
// choke point every master write goes through.
//
// "Doesn't mention" is the absence of the KEY, not an empty value. A record that
// carries `voice_guide: ''` is the user having deleted their guide on purpose,
// and carrying the old prose back over that would make the field impossible to
// clear — the write path (/api/update-voice-guide) sets the key either way.
export async function saveMasterCv(user_id, master) {
  const statesGuide =
    master && typeof master === 'object' && Object.prototype.hasOwnProperty.call(master, 'voice_guide');
  const statesClarifications =
    master && typeof master === 'object' && Object.prototype.hasOwnProperty.call(master, 'clarifications');
  // The read is best-effort: losing the guide is bad, losing a paid master build
  // because a read failed is worse, so a failure here never blocks the write.
  // Both fields are the USER'S own writing and no extraction emits them, so a
  // rebuild from a fresh CV upload would silently delete them.
  if (master && typeof master === 'object' && (!statesGuide || !statesClarifications)) {
    try {
      const stored = await getMasterCv(user_id);
      const kept = String(stored?.voice_guide || '').trim();
      if (!statesGuide && kept) master = { ...master, voice_guide: kept };
      const notes = Array.isArray(stored?.clarifications) ? stored.clarifications : [];
      if (!statesClarifications && notes.length) master = { ...master, clarifications: notes };
    } catch (e) {
      logger.error('saveMasterCv: could not read stored voice_guide/clarifications:', e.message);
    }
  }
  const { data, error } = await getAdminSupabase()
    .from('cv_data')
    .upsert([{ user_id, master_cv: master }], { onConflict: ['user_id'] })
    .select('user_id');
  if (error) throw new Error(`saveMasterCv failed: ${error.message || JSON.stringify(error)}`);
  if (!data || data.length === 0) {
    throw new Error(`saveMasterCv saved nothing for user ${user_id}`);
  }
  return data;
}

// ── Voice profile ────────────────────────────────────────────────────────────
//
// The per-user VOICE PROFILE: samples of their own writing, the extracted
// List A / List B(+translations), and their own hand-edited lines. Stored in its
// own JSONB column, NOT inside master_cv, and that separation is load-bearing:
// the master is the evidence set the truth-verify pass and the Layer 6 validator
// check every generated claim against, so voice text living in it would launder
// a claim from a writing sample into a "supported" fact.
export async function getVoiceProfile(user_id) {
  const { data, error } = await supabase
    .from('cv_data')
    .select('voice_profile')
    .eq('user_id', user_id)
    .maybeSingle();
  if (error) throw error;
  return data?.voice_profile || null;
}

// Service-role write, upsert for the same reason saveMasterCv uses one: an
// update whose filter matches no row reports no error and writes nothing.
// Only user_id + voice_profile are sent, so cv_data and master_cv are untouched.
export async function saveVoiceProfile(user_id, profile) {
  const { data, error } = await getAdminSupabase()
    .from('cv_data')
    .upsert([{ user_id, voice_profile: profile }], { onConflict: ['user_id'] })
    .select('user_id');
  if (error) throw new Error(`saveVoiceProfile failed: ${error.message || JSON.stringify(error)}`);
  if (!data || data.length === 0) {
    throw new Error(`saveVoiceProfile saved nothing for user ${user_id}`);
  }
  return data;
}

// getCvData (ALIAS: for handler expecting this name)
export async function getCvData(user_id) {
  const { data, error } = await supabase
    .from('cv_data')
    .select('*')
    .eq('user_id', user_id)
    .single();
  if (error) throw error;
  return data.cv_data;
}

// Get user (by user_id)
export async function getUser(user_id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user_id)
    .single();
  if (error) throw error;
  return data;
}

// Decrement token
export async function decrementToken(user_id) {
  const { data, error } = await supabase.rpc('decrement_token', { p_user_id: user_id });
  if (error) throw error;
  return data;
}

// Add tokens (used by Stripe webhook — always call this, never read-modify-write)
export async function addTokens(user_id, amount) {
  const { data, error } = await supabase.rpc('add_tokens', { p_user_id: user_id, p_amount: amount });
  if (error) throw error;
  return data;
}

// Log AI cost directly to transactions (bypasses HTTP self-call, safe on serverless)
export async function logAiTransaction({
  user_id,
  source_gen_id = null,
  model,
  cache_hit_tokens = 0,
  cache_miss_tokens = 0,
  completion_tokens = 0,
  thinking_tokens = 0,
  detail = {},
  key_index = null,
}) {
  const db = getAdminSupabase();

  const { data: pricing, error: pricingError } = await db
    .from('model_pricing')
    .select('event_type, cost_per_call')
    .eq('model', model);

  if (pricingError || !pricing?.length) {
    logger.error('logAiTransaction: pricing lookup failed for model', model, pricingError);
    return;
  }

  const priceMap = {};
  for (const row of pricing) priceMap[row.event_type] = parseFloat(row.cost_per_call);

  const amount_usd = (
    cache_hit_tokens  * (priceMap['cache_hit']  || 0) +
    cache_miss_tokens * (priceMap['cache_miss'] || 0) +
    completion_tokens * (priceMap['completion'] || 0)
  ).toFixed(12);

  const { error } = await db.from('transactions').insert([{
    user_id,
    type: 'ai_cost',
    source_gen_id,
    model,
    cache_hit_tokens,
    cache_miss_tokens,
    completion_tokens,
    thinking_tokens,
    amount_usd,
    detail,
    key_index,
  }]);

  if (error) logger.error('logAiTransaction: insert failed', error.message);
}

// Delete all data for a user (GDPR self-delete)
export async function deleteUserData(user_id) {
  const db = getAdminSupabase();
  for (const table of ['gen_data', 'cv_data', 'magic_tokens']) {
    const { error } = await db.from(table).delete().eq('user_id', user_id);
    if (error) throw new Error(`deleteUserData: ${table} delete failed: ${error.message}`);
  }
  const { error: txErr } = await db.from('transactions').delete().eq('user_id', user_id);
  if (txErr) throw new Error(`deleteUserData: transactions delete failed: ${txErr.message}`);
  const { error: userErr } = await db.from('users').delete().eq('user_id', user_id);
  if (userErr) throw new Error(`deleteUserData: users delete failed: ${userErr.message}`);
}

// Get latest analysis for user
export async function getLatestAnalysis(user_id) {
  const { data, error } = await getAdminSupabase()
    .from('gen_data').select('content')
    .eq('user_id', user_id).eq('type', 'analysis')
    .order('created_at', { ascending: false }).limit(1).single();
  if (error) throw error;
  return data;
}

// Every generated CV / cover letter for a user, newest LAST so the caller can
// append them straight into the version arrays the viewer already keeps. The
// documents were always persisted here; without this read they only ever lived
// in component state, so a reload lost everything not yet downloaded.
export async function getGeneratedDocs(user_id, { limit = 20 } = {}) {
  const { data, error } = await getAdminSupabase()
    .from('gen_data')
    .select('type, tone, content, created_at')
    .eq('user_id', user_id)
    .in('type', ['cv', 'cover'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse();
}

// Get all CVs for user
export async function getCvList(user_id) {
  const { data, error } = await getAdminSupabase()
    .from('cv_data').select('*')
    .eq('user_id', user_id).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Get user stats (generations_left, tokens, email)
export async function getUserStats(user_id) {
  const { data, error } = await getAdminSupabase()
    .from('users').select('generations_left, tokens, free_downloads_left, email')
    .eq('user_id', user_id).single();
  if (error) throw error;
  return data;
}

// Background-generation run status, keyed by the client-minted generation_id.
//
// Deliberately the DATABASE and not Redis: the poll endpoint is the one place a
// Redis outage would be fatal rather than degraded (the gen_lock fails open, a
// missing status does not — the browser just spins). gen_data already carries
// the run id in analysis_id, and every other reader filters on `type`, so a
// 'generation_status' row is invisible to them.
const GENERATION_STATUS_TYPE = 'generation_status';

export async function saveGenerationStatus(user_id, generation_id, payload) {
  return saveGeneratedDoc({
    user_id,
    source_cv_id: user_id,
    type: GENERATION_STATUS_TYPE,
    tone: null,
    content: JSON.stringify(payload),
    analysis_id: generation_id,
  });
}

export async function getGenerationStatus(user_id, generation_id) {
  const { data, error } = await getAdminSupabase()
    .from('gen_data').select('content')
    .eq('user_id', user_id).eq('analysis_id', generation_id).eq('type', GENERATION_STATUS_TYPE)
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  const content = data?.[0]?.content;
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

// Get gen_data row by analysis_id (for polling)
export async function getGenDataByAnalysisId(user_id, analysis_id) {
  const { data, error } = await getAdminSupabase()
    .from('gen_data').select('content')
    .eq('user_id', user_id).eq('analysis_id', analysis_id).eq('type', 'analysis')
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  return data;
}

// Get user by email — the ORIGINAL account, oldest first.
//
// Never demand exactly one row here. `users.email` has no unique constraint and
// uploads mint an anonymous account before login knows who the visitor is, so an
// email can legitimately be on several rows. A single-row request errors out on
// duplicates (PGRST116) and, if that error is swallowed, reads as "no such user"
// — which makes login adopt the throwaway upload account, stamp the email onto
// it, and create yet another duplicate on every attempt. Oldest wins so the
// established account (with the user's tokens and history) is the one returned,
// and the error is surfaced rather than discarded.
export async function getUserByEmail(email) {
  const { data, error } = await getAdminSupabase()
    .from('users')
    .select('user_id, email')
    .eq('email', email)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

// Attach an email to an existing user_id (the anonymous-upload session signing
// up). A bare UPDATE is not enough: Supabase reports no error when it matches
// zero rows, so a user_id with no users row silently lost its email and the
// account never appeared. Insert the row in that case, and return it either way
// so the caller can trust the write landed.
export async function updateUserEmail(user_id, email) {
  const emailNorm = String(email).toLowerCase().trim();
  const admin = getAdminSupabase();

  const { data, error } = await admin
    .from('users').update({ email: emailNorm }).eq('user_id', user_id)
    .select('user_id, email');
  if (error) throw error;
  if (data?.length) return data[0];

  const { data: created, error: insertErr } = await admin
    .from('users').insert([{ user_id, email: emailNorm }])
    .select('user_id, email').maybeSingle();
  if (insertErr) throw new Error(`updateUserEmail failed: ${insertErr.message}`);
  return created;
}

// Atomically spend a download credit: a free download first, else a paid token.
// Returns 'free' | 'token' | 'none'. Race-safe via the consume_download_credit RPC.
export async function consumeDownloadCredit(user_id) {
  const { data, error } = await supabase.rpc('consume_download_credit', { p_user_id: user_id });
  if (error) throw error;
  return data;
}

// Mark a card as verified (Stripe SetupIntent succeeded — no charge taken) and
// grant the free-download allowance. Idempotent: only the first verification
// flips the flag and grants downloads, so a replayed webhook can't double-grant.
// Returns true if this call performed the (first) grant.
export async function markCardVerified(user_id, stripe_customer_id, freeDownloadsGrant) {
  const { data, error } = await getAdminSupabase()
    .from('users')
    .update({
      card_on_file: true,
      card_verified_at: new Date().toISOString(),
      stripe_customer_id,
      free_downloads_left: freeDownloadsGrant,
    })
    .eq('user_id', user_id)
    .eq('card_on_file', false)
    .select('user_id');
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

// Read the user's saved candidate-core profile (job-agnostic "who I am").
export async function getCandidateCore(user_id) {
  const { data, error } = await getAdminSupabase()
    .from('users').select('candidate_core').eq('user_id', user_id).single();
  if (error) throw error;
  return data?.candidate_core || '';
}

// Top the free generation allowance back up after a successful download.
//
// This SETS the balance before: `update({ generations_left: amount })`. A user on
// the DB default of 10 who downloaded one document had their balance overwritten
// with 2 — the "refill" silently destroyed 8 generations they had already been
// given, and looked from the outside like generating cost five times what it
// does. The top_up_generations RPC uses greatest(generations_left, amount), so a
// download can only ever raise the balance to the allowance, never lower it.
//
// Errors are checked rather than try/caught at the call site: Supabase RESOLVES
// with { error } instead of throwing, so a blocked write used to pass silently
// and the user never got their generations back.
export async function topUpFreeGenerations(user_id, amount) {
  const { error } = await getAdminSupabase()
    .rpc('top_up_generations', { user_id, amount });
  if (error) throw new Error(`topUpFreeGenerations failed: ${error.message}`);
}

// Overwrite candidate_core with the user's own edit.
export async function updateCandidateCore(user_id, core) {
  const { error } = await getAdminSupabase()
    .from('users').update({ candidate_core: core }).eq('user_id', user_id);
  if (error) throw error;
}

// Create a new user with email
// One account per email. The unique index added in migration 006 is the real
// guarantee; this handles the race where two concurrent signups for the same
// address both pass the getUserByEmail check — the loser adopts the winner's
// account instead of erroring or minting a duplicate.
export async function createUserWithEmail(email) {
  const emailNorm = String(email).toLowerCase().trim();
  const { data, error } = await getAdminSupabase()
    .from('users').insert([{ email: emailNorm, user_id: crypto.randomUUID() }])
    .select('user_id').maybeSingle();
  if (error) {
    if (error.code === '23505') {
      const existing = await getUserByEmail(emailNorm);
      if (existing?.user_id) return { user_id: existing.user_id };
    }
    throw new Error(`createUserWithEmail failed: ${error.message}`);
  }
  return data;
}

// Get a valid magic token
export async function getMagicToken(token) {
  const { data, error } = await getAdminSupabase()
    .from('magic_tokens').select('*')
    .eq('token', token).eq('used', false)
    .gt('expires_at', new Date().toISOString()).single();
  if (error) return null;
  return data;
}

// Delete a magic token
export async function deleteMagicToken(token) {
  await getAdminSupabase().from('magic_tokens').delete().eq('token', token);
}

// Insert a new magic token
export async function insertMagicToken({ email, token, user_id, expires_at, remember_me }) {
  const { error } = await getAdminSupabase().from('magic_tokens').insert([{
    email, token, user_id, expires_at, remember_me, used: false,
  }]);
  if (error) throw new Error(`insertMagicToken failed: ${error.message}`);
}

// Delete all magic tokens for an email
export async function deleteMagicTokensByEmail(email) {
  await getAdminSupabase().from('magic_tokens').delete().eq('email', email);
}

// Save generated doc
export async function saveGeneratedDoc({
  user_id,
  source_cv_id,
  type,
  tone,
  company,
  job_title,
  file_name,
  content,
  analysis_id
}) {
  const { data, error } = await getAdminSupabase()
    .from('gen_data')
    .insert([{
      user_id,
      source_cv_id,
      type,
      tone,
      company,
      job_title,
      file_name,
      content,
      ...(analysis_id ? { analysis_id } : {})
    }]);
  if (error) throw error;
  return data;
}
