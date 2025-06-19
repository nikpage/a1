// pages/api/get-analysis.js

import { supabase } from '../../utils/database'

export default async function handler(req, res) {
  const { user_id, type, cv_text_hash, job_text_hash } = req.body

  if (!user_id) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const { data, error } = await supabase
    .from('gen_data')
    .select('*')
    .eq('user_id', user_id)
    .eq('type', 'analysis')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()


  if (error || !data) {
    return res.status(404).json({ error: 'Analysis not found' })
  }

  return res.status(200).json({ analysis: data.content })
}
