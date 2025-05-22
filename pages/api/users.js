// pages/api/users.js
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  switch (req.method) {
    case 'POST': {
      const secret = uuidv4();
      const { data, error } = await supabase
        .from('users')
        .insert({ secret })
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ userId: data.id, secret: data.secret });
    }
    case 'GET': {
      const { secret } = req.query;
      if (!secret) return res.status(400).json({ error: 'Secret is required' });
      const { data, error } = await supabase
        .from('users')
        .select('id, email, tokens, secret')
        .eq('secret', secret)
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    default:
      res.setHeader('Allow', ['POST','GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
