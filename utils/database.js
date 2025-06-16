// utils/database.js
import { createClient } from '@supabase/supabase-js'

console.log('Initializing Supabase client with env vars:')
NEXT_PUBLIC_SUPABASE_URL=https://znnmvfseggnkgaybodki.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpubm12ZnNlZ2dua2dheWJvZGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1NDE2OTYsImV4cCI6MjA2NTExNzY5Nn0.d6fA6pxQytItgMP7RBBLN-dM7dSH2glnodrD_BOFtR0
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Supabase env vars missing or empty')
    throw new Error('Supabase env vars missing')
  }
  return createClient(url, key, {
    realtime: { enabled: false },
  })
}

export async function upsertUser(user_id, tokens = 3) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .upsert({ user_id, tokens })
    .select()
  if (error) {
    console.error('upsertUser DB error:', error)
    throw error
  }
  return data[0]
}

export async function upsertCV(user_id, cv_file_url, cv_data) {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('cv_data')
    .upsert({ user_id, cv_file_url, cv_data })
  if (error) {
    console.error('upsertCV DB error:', error)
    throw error
  }
}

export async function getCVData(user_id) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('cv_data')
    .select('*')
    .eq('user_id', user_id)
    .single()
  if (error) {
    console.error('getCVData DB error:', error)
    throw error
  }
  return data
}

export async function getUser(user_id) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user_id)
    .single()
  if (error) {
    console.error('getUser DB error:', error)
    throw error
  }
  return data
}

export async function decrementToken(user_id) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('decrement_token', { uid: user_id })
  if (error) {
    console.error('decrementToken DB error:', error)
    throw error
  }
  return data
}

export default getSupabaseClient()
