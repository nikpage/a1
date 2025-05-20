// pages/api/users.js
import { supabase } from '../../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  // Generate a new UUID for the user
  const userId = uuidv4();
  // Insert into Supabase users table
  const { data, error } = await supabase
    .from('users')
    .insert({ id: userId })
    .select('id');

  if (error) {
    console.error('Supabase user insert error:', error);
    return res.status(500).json({ error: error.message });
  }

  // Return the new userId for secret URL
  res.status(200).json({ userId: data[0].id });
}
