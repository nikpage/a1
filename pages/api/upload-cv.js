// pages/api/upload-cv.js

import formidable from 'formidable'
import { upsertUser, upsertCV } from '../../utils/database'
import extractTextFromPDF from '../../utils/pdf-extract'
import mammoth from 'mammoth'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('ENV VARS CHECK:', {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
})

console.log("Handler HIT")

function genSessionId() {
  return crypto.randomUUID()
}

export const config = { api: { bodyParser: false } }

// Phone extraction + SHA-256 hash (pure JS)
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

// Extract text from DOCX files
async function extractTextFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error) {
    console.error('DOCX extraction error:', error)
    throw new Error('Failed to extract text from DOCX file')
  }
}

// Main API handler
export default async function handler(req, res) {
  console.log("Upload handler called:", req.method, req.url)
  if (req.method !== 'POST') {
    console.log("Method not allowed:", req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const form = formidable()
  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.log("Formidable error:", err)
        return res.status(400).json({ error: 'Upload failed', details: String(err) })
      }

      const file = files.file
      if (!file) {
        console.log("No file uploaded")
        return res.status(400).json({ error: 'No file uploaded' })
      }

      console.log("File received:", file.originalFilename || file.newFilename || file.filepath || file.name, file.mimetype, file.size)
      const uploadedFileName = file.originalFilename || file.newFilename || file.name || 'unknown'

      // Check for supported file types
      const supportedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!file.mimetype || !supportedTypes.includes(file.mimetype)) {
        console.log("Unsupported file type:", file.mimetype)
        return res.status(400).json({ error: 'File must be PDF or DOCX format' })
      }

      if (file.size > 200 * 1024) {
        console.log("File too large:", file.size)
        return res.status(400).json({ error: 'File too large' })
      }

      let buffer
      if (file.filepath) {
        const fs = require('fs')
        buffer = fs.readFileSync(file.filepath)
        console.log("Read buffer from file.filepath")
      } else if (Buffer.isBuffer(file)) {
        buffer = file
        console.log("Used file as buffer directly")
      } else {
        buffer = await streamToBuffer(file)
        console.log("Used streamToBuffer fallback")
      }

      let text
      try {
        // Extract text based on file type
        if (file.mimetype === 'application/pdf') {
          text = await extractTextFromPDF(buffer)
          console.log("Extracted PDF text:", text && text.length > 400 ? text.slice(0, 400) + '…' : text)
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          text = await extractTextFromDOCX(buffer)
          console.log("Extracted DOCX text:", text && text.length > 400 ? text.slice(0, 400) + '…' : text)
        }

        if (!text || !text.trim()) {
          console.log("No text extracted from file")
          return res.status(400).json({ error: "No text extracted from file" })
        }
      } catch (err) {
        console.log("File parse error:", err)
        return res.status(400).json({ error: 'File parse error', details: String(err) })
      }

      // --- PHONE EXTRACT & HASH ---
      let phone = extractPhone(text)
      let phone_hash = null
      if (phone) {
        phone_hash = await sha256(phone)
        console.log("Extracted phone:", phone, "Phone hash:", phone_hash)
      } else {
        console.log("No phone found in CV text")
      }
      // --- END PHONE EXTRACT & HASH ---
      console.log('fields.user_id:', fields.user_id)

      // THIS BLOCK IS THE REQUIRED CHANGE
      const user_id = fields.user_id || genSessionId();
      const { data, error } = await supabase
        .from('gen_data')
        .select('content')
        .eq('user_id', user_id.toString())
        .eq('type', 'analysis')
        .order('created_at', { ascending: false })
        .limit(1);

      try {
        console.log('Before upsertUser:', user_id, phone_hash);
        await upsertUser(user_id, phone_hash)
        await upsertCV(user_id, text)
        await supabase.from('data_gen').upsert({ user_id, content: text, type: 'cv' });
        console.log("DB save successful:", user_id)

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

// Buffer utility, never  remove!
function streamToBuffer(file) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const stream = file._readStream || file._writeStream || file
    if (!stream) {
      console.log("No file stream")
      return reject(new Error('No file stream'))
    }
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', err => {
      console.log("Stream error", err)
      reject(err)
    })
  })
}
