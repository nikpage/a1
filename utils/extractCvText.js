// utils/extractCvText.js
//
// Shared CV text extraction used by BOTH the first-upload path
// (pages/api/upload-cv.js) and the add-another-CV / merge path
// (pages/api/add-cv.js). One place validates the file type/size and turns a
// formidable upload into plain text, so the two routes can never drift apart.

import fs from 'fs';
import mammoth from 'mammoth';
import extractTextFromPDF from './pdf-extract';
import { logger } from '../lib/logger';

const SUPPORTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_BYTES = 200 * 1024;

// Thrown for client-fixable problems (wrong type, too big, unreadable) so the
// route can answer 400 with a clear message instead of a 500.
export class CvFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CvFileError';
    this.isClientError = true;
  }
}

async function extractTextFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    logger.error('DOCX extraction error:', error.message);
    throw new CvFileError('Failed to extract text from DOCX file');
  }
}

function readBuffer(file) {
  if (file?.filepath) return fs.readFileSync(file.filepath);
  if (Buffer.isBuffer(file)) return file;
  return null;
}

// Validate a formidable file and return its extracted plain text.
// Throws CvFileError for any client-fixable problem.
export async function extractTextFromUpload(file) {
  if (!file) throw new CvFileError('No file uploaded');

  if (!file.mimetype || !SUPPORTED_TYPES.includes(file.mimetype)) {
    throw new CvFileError('File must be PDF or DOCX format');
  }
  if (file.size > MAX_BYTES) {
    throw new CvFileError('File too large');
  }

  const buffer = readBuffer(file);
  if (!buffer) throw new CvFileError('No file stream');

  let text;
  try {
    if (file.mimetype === 'application/pdf') {
      text = await extractTextFromPDF(buffer);
    } else {
      text = await extractTextFromDOCX(buffer);
    }
  } catch (err) {
    if (err instanceof CvFileError) throw err;
    throw new CvFileError(`File parse error: ${String(err)}`);
  }

  if (!text || !text.trim()) {
    throw new CvFileError('No text extracted from file');
  }
  return text;
}
