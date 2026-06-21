// path: pages/api/get-cvs.js
import { createClient } from '@supabase/supabase-js'
import requireAuth from '../../lib/requireAuth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  const { user_id } = req.user

  const { data, error } = await supabase
    .from('cv_data')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  res.status(200).json(data)
}

export default requireAuth(handler)
