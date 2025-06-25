// pages/api/stripe/add-tokens.js

import { supabase } from '../../../utils/database'


export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, amount } = req.body
  if (!user_id || !amount) return res.status(400).json({ error: 'Missing user_id or amount' })

  const { data, error } = await supabase
    .rpc('add_tokens', { p_user_id: user_id, p_amount: amount })

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ success: true })
}
