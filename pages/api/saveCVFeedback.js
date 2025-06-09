
// /pages/api/saveCVFeedback.js
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
if (req.method !== 'POST') {
res.status(405).json({ error: 'Only POST requests allowed' });
return;
}

const { feedback } = req.body;

if (!feedback) {
console.log('Missing required field:', { feedback });
res.status(400).json({ error: 'Missing required field: feedback' });
return;
}

try {
const feedbackId = uuidv4();

const { data, error } = await supabase.from('cv_feedback').insert({
  id: feedbackId,
  feedback: feedback,
  created_at: new Date().toISOString(),
});

if (error) {
  console.error('Supabase insert error:', error);
  res.status(500).json({ error: 'Failed to save CV feedback' });
  return;
}

console.log('CV feedback saved:', feedbackId);

res.status(200).json({
  message: 'CV feedback saved successfully!',
  feedbackId: feedbackId
});
return;
} catch (e) {
console.error('Unexpected error:', e);
res.status(500).json({ error: 'Internal server error' });
return;
}
}
