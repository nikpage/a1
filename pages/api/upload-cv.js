// pages/api/upload-cv.js

import formidable from 'formidable'
import fs from 'fs'
import extractTextFromPDF from '../../utils/pdf-extract'
import { upsertUser, upsertCV } from '../../utils/database'
import genSessionId from '../../utils/session'
import { analyzeCV } from '../../utils/openai'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable()

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Upload failed' })

    const file = files.file
    if (!file) return res.status(400).json({ error: 'No file uploaded' })
    if (!file.mimetype || file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'Not a PDF' })
    if (file.size > 200 * 1024) return res.status(400).json({ error: 'File too large' })
    const filepath = file.filepath || file.path
    if (!filepath) return res.status(400).json({ error: 'File path error' })

    const buffer = fs.readFileSync(filepath)

    let text
    try {
      text = await extractTextFromPDF(buffer)
    } catch (e) {
      return res.status(400).json({ error: 'PDF parse error' })
    }

    let dsAnalysis
    try {
      dsAnalysis = await analyzeCV(text)
    } catch (e) {
      return res.status(500).json({ error: 'DS error' })
    }

    const user_id = genSessionId()

    try {
      await upsertUser(user_id)
      await upsertCV(user_id, null, text)
    } catch (e) {
      return res.status(500).json({ error: 'DB error' })
    }

    // Return DS result directly, do NOT store in DB
    res.status(200).json({ user_id, dsAnalysis })
  })
}
