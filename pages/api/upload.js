// pages/api/upload.js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const { userId, file } = req.body; // Expecting file as base64 or File object
    // Convert base64 to Buffer if needed
    const fileBuffer = Buffer.from(file.content, 'base64');
    const filePath = `${userId}/${file.name}`;

    // Upload to Supabase Storage bucket 'cv-files'
    const { data, error } = await supabase.storage
      .from('cv-files')
      .upload(filePath, fileBuffer, { contentType: file.type });
    if (error) throw error;

    // Generate public URL
    const { publicUrl, error: urlError } = supabase.storage
      .from('cv-files')
      .getPublicUrl(data.path);
    if (urlError) throw urlError;

    res.status(200).json({ fileUrl: publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
}
