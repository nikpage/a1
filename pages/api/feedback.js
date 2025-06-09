// pages/api/feedback.js
import { buildCVFeedbackPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';
import { supabase } from '../../lib/supabase'; // Adjust the path if needed

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { metadata, cvBody, prompt, userId } = req.body;
  if (!metadata || !cvBody) {
    return res.status(400).json({ error: 'metadata and cvBody are required' });
  }

  try {
    // Use provided prompt or build from metadata
    const finalPrompt = prompt || buildCVFeedbackPrompt({ metadata, parsedCV: cvBody });

    // Call DeepSeek (our AI service)
    const raw = await generate(finalPrompt);
    let feedback;

    try {
      const parsed = JSON.parse(raw);
      feedback = parsed.feedback || raw;
    } catch {
      feedback = raw;
    }

    // Directly save feedback to Supabase (no fake res object!)
    const feedbackData = {
      cv_metadata_id: metadata.id,
      feedback: typeof feedback === 'object' ? feedback : { text: feedback },
      user_id: userId,
      display_name: metadata.display_name || 'Unnamed CV',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('cv_feedback').insert([feedbackData]);

    if (error) {
      console.error('Failed to save feedback:', error);
      return res.status(500).json({ error: 'Failed to save feedback' });
    }

    return res.status(200).json({ feedback });
  } catch (err) {
    console.error('Feedback API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
