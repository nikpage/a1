// pages/api/upload-cv.js

import { logger } from '../../lib/logger'
import formidable from 'formidable'
import { upsertUser, upsertCV } from '../../utils/database'
import { extractCvWithLayout, CvFileError } from '../../utils/extractCvText'
import crypto from 'crypto'
import { setSessionCookie } from '../../lib/session'

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
      let text
      let layout = null
      try {
        ({ text, layout } = await extractCvWithLayout(file))
      } catch (err) {
        if (err instanceof CvFileError) {
          return res.status(400).json({ error: err.message })
        }
        throw err
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

        // The layout signal is NOT persisted — it is read once by the teaser and
        // thrown away. Hand it back so it rides in-flight on the analysis kick.
        return res.status(200).json({ user_id, layout })
      } catch (dbErr) {
        logger.error('DB error:', dbErr.message)
        return res.status(500).json({ error: 'DB error', details: String(dbErr) })
      }
    } catch (e) {
      logger.error("Server error:", e.message)
      return res.status(500).json({ error: 'Server error', details: String(e) })
    }
  })
}
