// pages/api/upload-cv.js

import formidable from 'formidable'
import { upsertUser, upsertCV } from '../../utils/database'
import extractTextFromPDF from '../../utils/pdf-extract'
import crypto from 'crypto'

export const config = { api: { bodyParser: false } }

function genSessionId() {
  return crypto.randomUUID()
}

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

// Single handler function with CORS headers at the start
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.thecv.pro');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log("Upload handler called:", req.method, req.url)

  if (req.method !== 'POST') {
    console.log("Method not allowed:", req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('ENV VARS CHECK:', {
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  // Rest of your formidable logic...
  const form = formidable()
  // ... continue with your existing form.parse logic
}

// Your streamToBuffer function at the bottom
