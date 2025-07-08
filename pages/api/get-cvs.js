// path: pages/api/get-cvs.js

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  const { data, error } = await supabase
    .from('cv_data')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  res.status(200).json(data)
}
