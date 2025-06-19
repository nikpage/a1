import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
