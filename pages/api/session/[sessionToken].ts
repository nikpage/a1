// pages/api/session/[sessionToken].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionToken } = req.query

  if (!sessionToken || typeof sessionToken !== 'string') {
    return res.status(400).json({ error: 'Invalid session token' })
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('tokens')
      .eq('user_id', sessionToken)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Session not found' })
    }

    return res.status(200).json({ tokens: data.tokens ?? 3 })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
