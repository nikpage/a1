import pdf from 'pdf-parse/lib/pdf-parse.js'

export default async function extractTextFromPDF(buffer) {
  const data = await pdf(buffer)
  return data.text
}
