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
    if (err) {
      console.error('Parse error:', err)
      return res.status(400).json({ error: 'Upload failed' })
    }

    console.log('Files object:', JSON.stringify(files, null, 2))

    const file = files.file
    if (!file) {
      console.log('No file found in files object')
      return res.status(400).json({ error: 'No file uploaded' })
    }

    console.log('File object:', JSON.stringify(file, null, 2))

    if (!file.mimetype || file.mimetype !== 'application/pdf') {
      console.log('Invalid mimetype:', file.mimetype)
      return res.status(400).json({ error: 'Not a PDF' })
    }

    if (file.size > 200 * 1024) {
      console.log('File too large:', file.size)
      return res.status(400).json({ error: 'File too large' })
    }

    const filepath = file.filepath || file.path
    if (!filepath) {
      console.log('No filepath found')
      return res.status(400).json({ error: 'File path error' })
    }

    const buffer = fs.readFileSync(filepath)

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
  })
}
