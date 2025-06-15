// utils/database.js
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key, { realtime: { enabled: false } })
}

export async function upsertUser(user_id, tokens = 3) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .upsert({ user_id, tokens })
    .select()
  if (error) throw error
  return data[0]
}

export async function upsertCV(user_id, cv_file_url, cv_data) {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('cv_data')
    .upsert({ user_id, cv_file_url, cv_data })
  if (error) throw error
}

export async function getCVData(user_id) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cv_data')
    .select('*')
    .eq('user_id', user_id)
    .single()
  if (error) throw error
  return data
}

export async function getUser(user_id) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user_id)
    .single()
  if (error) throw error
  return data
}
