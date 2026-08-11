// utils/cvFileTypes.js
// Single source of truth for which CV file types the client accepts.
// Must stay in sync with SUPPORTED_TYPES in utils/extractCvText.js (server-side check).

export const CV_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export const CV_ACCEPT_ATTR = 'application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const CV_MAX_BYTES = 200 * 1024

export function isValidCvFile(file) {
  return !!file && CV_MIME_TYPES.includes(file.type) && file.size <= CV_MAX_BYTES
}
