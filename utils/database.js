// utils/database.js

import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger.js';
import crypto from 'crypto';

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
export async function upsertUser(user_id, phone_hash = null, email = null) {
    const { data, error } = await supabase
        .from('users')
        .upsert([{ user_id, phone_hash, email }], { onConflict: ['user_id'] })
        .select();
    if (error) {
        logger.error('UpsertUser error:', error.message, error.details);
        throw new Error(`UpsertUser failed: ${error.message}`);
    }
    logger.info('User upserted:', user_id);
    return data;
}

// Upsert CV
export async function upsertCV(user_id, cv_data) {
  const { data, error } = await supabase
    .from('cv_data')
    .upsert([{ user_id, cv_data }], { onConflict: ['user_id'] });
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
    .from('users').select('generations_left, tokens, email')
    .eq('user_id', user_id).single();
  if (error) throw error;
  return data;
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

// Get user by email
export async function getUserByEmail(email) {
  const { data } = await getAdminSupabase()
    .from('users').select('user_id, email').eq('email', email).maybeSingle();
  return data;
}

// Update user email
export async function updateUserEmail(user_id, email) {
  const { error } = await getAdminSupabase()
    .from('users').update({ email }).eq('user_id', user_id);
  if (error) throw error;
}

// Read the user's saved candidate-core profile (job-agnostic "who I am").
export async function getCandidateCore(user_id) {
  const { data, error } = await getAdminSupabase()
    .from('users').select('candidate_core').eq('user_id', user_id).single();
  if (error) throw error;
  return data?.candidate_core || '';
}

// Seed candidate_core from the AI draft, but ONLY if the user hasn't one yet —
// never clobber a value the user has edited. Returns true if it wrote.
export async function setCandidateCoreIfEmpty(user_id, core) {
  if (!core || !core.trim()) return false;
  const { data, error } = await getAdminSupabase()
    .from('users')
    .update({ candidate_core: core.trim() })
    .eq('user_id', user_id)
    .is('candidate_core', null)
    .select('user_id');
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

// Overwrite candidate_core with the user's own edit.
export async function updateCandidateCore(user_id, core) {
  const { error } = await getAdminSupabase()
    .from('users').update({ candidate_core: core }).eq('user_id', user_id);
  if (error) throw error;
}

// Create a new user with email
export async function createUserWithEmail(email) {
  const { data, error } = await getAdminSupabase()
    .from('users').insert([{ email, user_id: crypto.randomUUID() }])
    .select('user_id').maybeSingle();
  if (error) throw new Error(`createUserWithEmail failed: ${error.message}`);
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
  const { data, error } = await supabase
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
