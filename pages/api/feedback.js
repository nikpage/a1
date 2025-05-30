import { buildCVFeedbackPrompt } from '../../lib/prompt-builder';
import { generate } from '../../lib/deepseekClient';
import saveHandler from './save.js';

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
    const finalPrompt = prompt || buildCVFeedbackPrompt({ metadata, parsedCV: cvBody });
    const raw = await generate(finalPrompt);
    let feedback;

    try {
      const parsed = JSON.parse(raw);
      feedback = parsed.feedback || raw;
    } catch {
      feedback = raw;
    }

    // Auto-save feedback (the original working logic)
    await saveHandler(
      {
        method: 'POST',
        body: {
          userId,
          data: {},
          feedback: {
            cv_metadata_id: metadata.id,
            feedback: typeof feedback === 'object' ? feedback : { text: feedback },
          },
        },
      },
      {
        status: () => ({
          json: () => {},
        }),
      }
    );

    return res.status(200).json({ feedback });
  } catch (err) {
    console.error('Feedback API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
