// pages/api/upload-cv.js

import formidable from 'formidable'
import { upsertUser, upsertCV } from '../../utils/database'
import extractTextFromPDF from '../../utils/pdf-extract'
import mammoth from 'mammoth'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { setSessionCookie } from '../../lib/session'

// Task 1.5: use service-role key for writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function genSessionId() {
  return crypto.randomUUID()
}

export const config = { api: { bodyParser: false } }

function extractPhone(text) {
  const match = text.match(/(\+?\d[\d \-\(\)]{7,}\d)/)
  return match ? match[1].replace(/[^\d+]/g, '') : null
}

async function sha256(str) {
  if (typeof window === 'undefined') {
    const { createHash } = await import('crypto')
    return createHash('sha256').update(str).digest('hex')
  } else {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hash = await window.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

async function extractTextFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error) {
    console.error('DOCX extraction error:', error)
    throw new Error('Failed to extract text from DOCX file')
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const form = formidable()
  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        return res.status(400).json({ error: 'Upload failed', details: String(err) })
      }

      const file = files.file
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' })
      }

      const uploadedFileName = file.originalFilename || file.newFilename || file.name || 'unknown'

      const supportedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!file.mimetype || !supportedTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: 'File must be PDF or DOCX format' })
      }

      if (file.size > 200 * 1024) {
        return res.status(400).json({ error: 'File too large' })
      }

      let buffer
      if (file.filepath) {
        const fs = require('fs')
        buffer = fs.readFileSync(file.filepath)
      } else if (Buffer.isBuffer(file)) {
        buffer = file
      } else {
        buffer = await streamToBuffer(file)
      }

      let text
      try {
        if (file.mimetype === 'application/pdf') {
          text = await extractTextFromPDF(buffer)
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          text = await extractTextFromDOCX(buffer)
        }

        if (!text || !text.trim()) {
          return res.status(400).json({ error: "No text extracted from file" })
        }
      } catch (err) {
        return res.status(400).json({ error: 'File parse error', details: String(err) })
      }

      let phone = extractPhone(text)
      let phone_hash = null
      if (phone) {
        phone_hash = await sha256(phone)
      }

      // Task 1.2: mint from cookie if present, else generate new session id
      const user_id = genSessionId()

      try {
        await upsertUser(user_id, phone_hash)
        await upsertCV(user_id, text)
        // Task 1.5: the stray write to data_gen was removed — upsertCV already persists
        // the CV to cv_data; the misspelled data_gen table write was a duplicate and is gone.

        // Task 1.2: mint a session cookie so subsequent protected routes trust this visitor
        setSessionCookie(res, { user_id })

        return res.status(200).json({ user_id })
      } catch (dbErr) {
        console.error('DB error:', dbErr)
        return res.status(500).json({ error: 'DB error', details: String(dbErr) })
      }
    } catch (e) {
      console.error("Server error:", e)
      return res.status(500).json({ error: 'Server error', details: String(e) })
    }
  })
}

// Buffer utility, never remove!
function streamToBuffer(file) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const stream = file._readStream || file._writeStream || file
    if (!stream) {
      return reject(new Error('No file stream'))
    }
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', err => reject(err))
  })
}
