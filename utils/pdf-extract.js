import pdf from 'pdf-parse'

export default async function extractTextFromPDF(buffer) {
  const data = await pdf(buffer)
  return data.text
}
