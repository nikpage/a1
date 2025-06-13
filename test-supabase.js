// test-supabase.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  console.log('data:', data);
  console.log('error:', error);
})();
