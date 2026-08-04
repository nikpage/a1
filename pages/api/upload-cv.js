// pages/api/upload-cv.js

import { logger } from '../../lib/logger'
import formidable from 'formidable'
import { upsertUser, upsertCV } from '../../utils/database'
import { extractCvWithLayout, CvFileError } from '../../utils/extractCvText'
import crypto from 'crypto'
import { setSessionCookie } from '../../lib/session'
import { getTokenFromReq, verifyToken } from '../../lib/auth'

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

      // Identity comes from the SESSION when the visitor has one. This route is
      // deliberately unauthenticated (the landing page uploads before anyone has
      // an account), but "unauthenticated route" must never mean "new account on
      // every upload": minting unconditionally overwrote the signed-in visitor's
      // cookie with a fresh anonymous id, orphaning their real account — tokens,
      // master CV and all — and logging them out on every upload. Only a genuinely
      // anonymous visitor gets a new id; a signed-in one has their profile
      // REFRESHED in place (CLAUDE.md: one CV, one profile).
      const session = await verifyToken(getTokenFromReq(req))
      const user_id = session?.user_id || genSessionId()

      try {
        await upsertUser(user_id, phone_hash)
        await upsertCV(user_id, text)
        // Task 1.5: the stray write to data_gen was removed — upsertCV already persists
        // the CV to cv_data; the misspelled data_gen table write was a duplicate and is gone.

        // Refresh the session cookie so protected routes trust this visitor and
        // the 30-day window rolls forward. `email` is carried through from the
        // existing session — re-minting with user_id alone would silently strip
        // a signed-in user's email out of their own token.
        setSessionCookie(res, { user_id, email: session?.email ?? null })

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
