// utils/extractCvText.js
//
// Shared CV extraction used by the upload path (pages/api/upload-cv.js). One
// place validates the file type/size and turns a formidable upload into text,
// so callers can never drift apart.
//
// Two entry points:
//   extractTextFromUpload(file)  → plain text only (back-compatible).
//   extractCvWithLayout(file)    → { text, layout } — text PLUS the layout
//     sidecar (columns / scanned / date strings) the landing teaser needs to
//     judge the ATS gate against the REAL document, not the cleaned master CV.

import fs from 'fs';
import mammoth from 'mammoth';
import extractTextFromPDF, { extractPdfWithLayout } from './pdf-extract';
import { extractDateStrings, dateFormatShapes } from './cvLayout';
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

// DOCX text + layout. mammoth has no geometry, but its HTML preserves the two
// structural ATS hazards: tables (the usual multi-column vehicle, often read
// out of order) and embedded images. Text is the SAME extractRawText output the
// master build consumes, so nothing downstream shifts.
async function extractDocxWithLayout(buffer) {
  const text = await extractTextFromDOCX(buffer);
  let html = '';
  try {
    html = (await mammoth.convertToHtml({ buffer })).value || '';
  } catch (e) {
    // HTML conversion is best-effort; fall back to text-only layout signal.
    logger.error('DOCX html conversion failed (layout signal skipped):', e.message);
  }
  const hasTables = /<table/i.test(html);
  const hasImages = /<img/i.test(html);
  const layout = {
    format: 'docx',
    pages: null,
    columns: hasTables ? 2 : 1,
    multi_column: hasTables,
    has_tables: hasTables,
    has_images: hasImages,
    text_chars: text.replace(/\s/g, '').length,
    likely_scanned: false,
  };
  return { text, layout };
}

function readBuffer(file) {
  if (file?.filepath) return fs.readFileSync(file.filepath);
  if (Buffer.isBuffer(file)) return file;
  return null;
}

// Validate a formidable file and return its buffer + which extractor to use.
// Throws CvFileError for any client-fixable problem.
function validateAndRead(file) {
  if (!file) throw new CvFileError('No file uploaded');
  if (!file.mimetype || !SUPPORTED_TYPES.includes(file.mimetype)) {
    throw new CvFileError('File must be PDF or DOCX format');
  }
  if (file.size > MAX_BYTES) {
    throw new CvFileError('File too large');
  }
  const buffer = readBuffer(file);
  if (!buffer) throw new CvFileError('No file stream');
  return { buffer, isPdf: file.mimetype === 'application/pdf' };
}

// Plain-text extraction (back-compatible — text only).
export async function extractTextFromUpload(file) {
  const { buffer, isPdf } = validateAndRead(file);
  let text;
  try {
    text = isPdf ? await extractTextFromPDF(buffer) : await extractTextFromDOCX(buffer);
  } catch (err) {
    if (err instanceof CvFileError) throw err;
    throw new CvFileError(`File parse error: ${String(err)}`);
  }
  if (!text || !text.trim()) {
    throw new CvFileError('No text extracted from file');
  }
  return text;
}

// Text PLUS the layout sidecar. Date signal is derived from the text here so it
// is identical for PDF and DOCX. A null/failed layout is returned as null and
// callers persist nothing for it — the upload still succeeds on text alone.
export async function extractCvWithLayout(file) {
  const { buffer, isPdf } = validateAndRead(file);
  let text;
  let layout;
  try {
    ({ text, layout } = isPdf
      ? await extractPdfWithLayout(buffer)
      : await extractDocxWithLayout(buffer));
  } catch (err) {
    if (err instanceof CvFileError) throw err;
    throw new CvFileError(`File parse error: ${String(err)}`);
  }
  if (!text || !text.trim()) {
    throw new CvFileError('No text extracted from file');
  }
  if (layout && typeof layout === 'object') {
    const dates = extractDateStrings(text);
    layout.date_formats = dates;
    layout.mixed_date_formats = dateFormatShapes(dates).length > 1;
  }
  return { text, layout: layout || null };
}
