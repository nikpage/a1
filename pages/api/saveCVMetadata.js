// /pages/api/saveCVMetadata.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Only POST requests allowed' });
    return;
  }

  const { userId, cvData, displayName, documentInputId } = req.body;

  if (!cvData || !documentInputId) {
    console.log('Missing required fields:', { cvData, documentInputId });
    res.status(400).json({ error: 'Missing required fields: cvData or documentInputId' });
    return;
  }

  try {
    // Check if record exists first
    const { data: existingData } = await supabase
      .from('cv_metadata')
      .select('*')
      .eq('document_input_id', documentInputId)
      .single();

    let result;

    if (existingData) {
      // Update existing record
      result = await supabase
        .from('cv_metadata')
        .update({
          data: cvData,
          display_name: displayName || 'Unnamed CV',
          user_id: userId,
          updated_at: new Date().toISOString()
        })
        .eq('document_input_id', documentInputId);
    } else {
      // Insert new record
      result = await supabase
        .from('cv_metadata')
        .insert({
          document_input_id: documentInputId,
          data: cvData,
          display_name: displayName || 'Unnamed CV',
          user_id: userId,
          
        });
    }

    if (result.error) {
      console.error('Supabase error:', result.error);
      res.status(500).json({ error: 'Failed to save CV metadata' });
      return;
    }

    console.log('CV metadata saved:', documentInputId);

    res.status(200).json({
      message: 'CV metadata saved successfully!',
      documentInputId: documentInputId
    });
  } catch (e) {
    console.error('Unexpected error:', e);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
}
