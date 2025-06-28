// pages/api/get-docs.js

import { supabase } from '../../utils/database'

export default async function handler(req, res) {
  const { user_id } = req.body

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' })
  }

  const { data, error } = await supabase
    .from('gen_data')
    .select('type, content')
    .eq('user_id', user_id)
    .in('type', ['cv', 'cover'])
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: 'DB error' })
  }

  const result = { cv: null, cover: null }
  for (const row of data) {
    if (row.type === 'cv' && !result.cv) result.cv = row.content
    if (row.type === 'cover' && !result.cover) result.cover = row.content
  }

  return res.status(200).json(result)
