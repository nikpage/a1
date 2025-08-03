import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    // Test 1: Can we find the token at all?
    const test1 = await supabase.from('magic_tokens').select('token, used, expires_at').eq('token', token);

    // Test 2: Is the found token marked as 'used: false'?
    const test2 = await supabase.from('magic_tokens').select('token, used, expires_at').eq('token', token).eq('used', false);

    // Test 3: Does it pass the expiration check?
    const test3 = await supabase.from('magic_tokens').select('token, used, expires_at').eq('token', token).eq('used', false).gte('expires_at', new Date().toISOString());

    res.status(200).json({
      test1: {
        note: "Checks if a row with this token exists at all.",
        data: test1.data,
        error: test1.error
      },
      test2: {
        note: "Checks if the token exists AND is not used.",
        data: test2.data,
        error: test2.error
      },
      test3: {
        note: "This is the full query. Checks token, used status, AND expiration.",
        data: test3.data,
        error: test3.error
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'A critical error occurred during the debug process.', details: err.message });
  }
}
