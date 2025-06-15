// pages/api/upload-cv.js


import formidable from 'formidable'
import fs from 'fs'
import extractTextFromPDF from '../../utils/pdf-extract'
import { upsertUser, upsertCV } from '../../utils/database'
import genSessionId from '../../utils/session'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const form = formidable()
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Upload failed' })
    const file = files.file
    if (!file || file.mimetype !== 'application/pdf' || file.size > 200 * 1024) return res.status(400).json({ error: 'Invalid PDF' })
    const buffer = fs.readFileSync(file.filepath)
    let text
    try { text = await extractTextFromPDF(buffer) } catch { return res.status(400).json({ error: 'PDF parse error' }) }

    const user_id = genSessionId()
    try {
      await upsertUser(user_id)
      await upsertCV(user_id, null, text) // Only store parsed CV, not analysis
    } catch (e) {
      return res.status(500).json({ error: 'DB error' })
    }
    res.status(200).json({ user_id })
  })
}
