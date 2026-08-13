// utils/doc-filename.js
//
// The download filename for a generated document: [doc]-[FirstLast]_[Company]
// e.g. cv-NikPage_Xco.docx, cover-NikPage_Xco.docx
//
// Both halves come from the analysis JSON the document was written against —
// `cv_data.Name` (the candidate, extracted from their own CV) and
// `job_data.Company` (the employer, extracted from the ad). Either may be
// missing: a standalone review has no company, and a failed extraction has no
// name. Each absent part is simply dropped rather than guessed, so the worst
// case degrades to `cv` / `cv-NikPage` and never to a broken or misleading name.

// Accents map to their ASCII base and everything that is not a letter or digit
// is dropped, because the string ends up as a filename on Windows, macOS and
// Linux. Words are then joined PascalCase: "nik page" -> "NikPage".
function pascal(value) {
  const ascii = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const words = ascii.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

// The schema's own placeholders for "not extracted" (see utils/formatAnalysis.js)
// must never reach a filename as the literal text "n/a".
const PLACEHOLDERS = new Set(['', 'n/a', 'na', 'none', 'null', 'undefined', '0-10']);
function real(value) {
  const s = String(value ?? '').trim();
  return s && !PLACEHOLDERS.has(s.toLowerCase()) ? s : null;
}

// Accepts the analysis in whatever shape the caller holds it: the stored gen_data
// JSON string (optionally fenced), or an already-parsed object.
function parseAnalysis(analysis) {
  if (!analysis) return null;
  if (typeof analysis !== 'string') return analysis;
  const raw = analysis.trim().replace(/^```json/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// `type` is 'cv' or 'cover'. Returns the base name, without extension.
export function docFileName(type, analysis) {
  const data = parseAnalysis(analysis);
  const name = pascal(real(data?.cv_data?.Name));
  const company = pascal(real(data?.job_data?.Company));

  let base = String(type || 'document');
  if (name) base += `-${name}`;
  if (company) base += `_${company}`;
  return base;
}

export default docFileName;
