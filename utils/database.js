// utils/database.js
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

export async function upsertUser(user_id) {
  const supabase = createClient()
  const { data, error } = await supabase.from('users').upsert({ user_id, tokens: 3, created_at: new Date() }).select()
  if (error) throw error
  return data[0]
}

export async function upsertCV(user_id, cv_file_url, cv_data) {
  const supabase = createClient()
  const { error } = await supabase.from('cv_data').upsert({ user_id, cv_file_url, created_at: new Date(), cv_data })
  if (error) throw error
}

export async function getCVData(user_id) {
  const supabase = createClient()
  const { data, error } = await supabase.from('cv_data').select('*').eq('user_id', user_id).single()
  if (error) throw error
  return data
}

export async function getUser(user_id) {
  const supabase = createClient()
  const { data, error } = await supabase.from('users').select('*').eq('user_id', user_id).single()
  if (error) throw error
  return data
}

export async function decrementToken(user_id) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('decrement_token', { uid: user_id })
  if (error) throw error
  return data
}
