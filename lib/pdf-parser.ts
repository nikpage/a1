// lib/pdf-parser.ts
import pdf from 'pdf-parse'

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log('Starting PDF parsing...')
    const data = await pdf(buffer)
    console.log('PDF parsed successfully, text length:', data.text.length)
    return data.text
  } catch (error) {
    console.error('PDF parsing error:', error)
    console.error('Error message:', error.message)
    throw new Error(`Failed to extract text from PDF: ${error.message}`)
  }
}
