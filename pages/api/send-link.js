// path: /pages/api/send-link.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  console.log('REQ BODY:', req.body);  // ✅ check logs

  const { email, user_id } = req.body;

  if (!email || !user_id) {
    return res.status(400).json({ error: 'Missing email or user ID.' });
  }

  try {
    await resend.emails.send({
      from: 'TheCV.Pro <noreply@thecv.pro>',
      to: email,
      subject: 'Your Private Access Link - TheCV.Pro',
      text: `Here is your private link: https://thecv.pro/${user_id}`,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: err.message });
  }
}
