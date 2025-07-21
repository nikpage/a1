// utils/database.js

// ❗ REMOVED the createClient call from this file.
// ✅ ADDED this line to import the single, shared client.
import { supabase } from './supabase';

// Upsert user
export async function upsertUser(user_id, phone_hash = null, email = null) {
  const { data, error } = await supabase
    .from('users')
    .upsert([{ user_id, phone_hash, email }], { onConflict: ['user_id'] });
  if (error) throw error;
  return data;
}

// Upsert CV
export async function upsertCV(user_id, cv_data) {
  const { data, error } = await supabase
    .from('cv_data')
    .upsert([{ user_id, cv_data }], { onConflict: ['user_id'] });
  if (error) throw error;
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

// ❗ This export is no longer needed, as files should import the client
// from its source in 'utils/supabase.js'. It is removed for clarity.
