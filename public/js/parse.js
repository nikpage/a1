// api/parse.js
import { buffer } from 'micro';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const buf = await buffer(req);
  const ct  = req.headers['content-type'] || '';
  let text = '';

  if (ct.includes('application/pdf')) {
    const data = await pdf(buf);
    text = data.text;
  } else if (
    ct.includes('officedocument') ||
    ct.includes('wordprocessingml')
  ) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    text = value;
  } else {
    text = buf.toString('utf8');
  }

  res.status(200).json({ text });
}
