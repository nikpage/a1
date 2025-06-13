// pages/api/upload-cv.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { IncomingForm } from 'formidable'
import { supabaseAdmin } from '../../lib/supabase'
import { extractTextFromPDF } from '../../lib/pdf-parser'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const form = new IncomingForm({
      maxFileSize: 200 * 1024,
    })

    const { fields, files } = await new Promise<{ fields: any, files: any }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ fields, files })
      })
    })

    const file = Array.isArray(files.cv) ? files.cv[0] : files.cv

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const buffer = fs.readFileSync(file.filepath)

    console.log('File size:', buffer.length)
    console.log('File type:', file.mimetype)
    console.log('File name:', file.originalFilename)

    const cvText = await extractTextFromPDF(buffer)
    console.log('Extracted text length:', cvText?.length || 0)

    if (!cvText || cvText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from PDF' })
    }

    const userId = uuidv4()
    console.log('Generated userId:', userId)

    // Create user
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        user_id: userId,
        tokens: 3
      })

    if (userError) {
      console.error('User creation error:', userError)
      return res.status(500).json({ error: `Failed to create user: ${userError.message}` })
    }

    // Store CV data
    const { error: cvError } = await supabaseAdmin
      .from('cv_data')
      .insert({
        user_id: userId,
        cv_data: cvText
      })

    if (cvError) {
      console.error('CV data error:', cvError)
      return res.status(500).json({ error: `Failed to store CV data: ${cvError.message}` })
    }

    fs.unlinkSync(file.filepath)

    res.status(200).json({
      userId,
      success: true,
      extractedLength: cvText.length
    })
  } catch (error) {
    console.error('Upload error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error message:', error.message)
    res.status(500).json({ error: `Upload failed: ${error.message}` })
  }
}
