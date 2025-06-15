// pages/api/upload-cv.js

import formidable from 'formidable'
import fs from 'fs'
import extractTextFromPDF from '../../utils/pdf-extract'
import { upsertUser, upsertCV } from '../../utils/database'
import genSessionId from '../../utils/session'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({
    maxFileSize: 200 * 1024, // 200KB
    filter: ({ mimetype }) => mimetype === 'application/pdf'
  })

  try {
    const parsed = await form.parse(req)
    const files = parsed.files || parsed[1]
    const file = files.file?.[0] || files.file

    if (!file || file.size > 200 * 1024) {
      return res.status(400).json({ error: 'Invalid PDF' })
    }

    const buffer = fs.readFileSync(file.filepath)

    let text
    try {
      text = await extractTextFromPDF(buffer)
    } catch (e) {
      console.error('PDF parse error:', e)
      return res.status(400).json({ error: 'PDF parse error' })
    }

    const user_id = genSessionId()

    try {
      await upsertUser(user_id)
      await upsertCV(user_id, null, text)
    } catch (e) {
      console.error('DB error:', e)
      return res.status(500).json({ error: 'DB error' })
    }

    res.status(200).json({ user_id })

  } catch (err) {
    console.error('Form parse error:', err)
    return res.status(400).json({ error: 'Upload failed' })
  }
}
