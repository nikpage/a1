// utils/cvLayout.js
//
// Pure, dependency-free helpers for the LAYOUT SIGNAL — the small JSON sidecar
// persisted on cv_data.cv_layout and the short note fed to the landing teaser.
//
// WHY THIS EXISTS: the teaser's ATS gate and 7-second scan are judgments about
// the REAL uploaded document — a two-column layout that scrambles in an ATS, a
// scanned/image CV with no machine-readable text, inconsistent date strings.
// None of that signal survives into the cleaned master CV, so a teaser fed the
// master falsely passes every gate. The raw extracted text recovers most of it
// (order, dates, tenures), but column layout and "is this even machine-readable"
// cannot be seen from flattened text — those are captured here at extract time.
//
// Everything in this file is a pure function (no AI, no IO) and is unit-tested
// in cvLayout.test.js. The heuristics are intentionally conservative: when in
// doubt they report single-column / not-scanned, because a false ATS-fail on
// the landing page is worse than a missed one.

// --- DATE STRINGS ----------------------------------------------------------
// Collect the DISTINCT verbatim date tokens as they appear in the CV so the
// teaser can quote the actual offending string when flagging an unreadable or
// inconsistent date format, instead of inventing one.
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const PRESENT = '(?:present|current|now|date|ongoing|to\\s+date)';
const SEP = '\\s*(?:[-–—]|to|until|–)\\s*';

// Ordered so the most specific (ranges) match before bare year/month tokens.
const DATE_PATTERNS = [
  // Month Year – Month Year / Month Year – Present
  new RegExp(`${MONTH}\\.?\\s*\\d{4}${SEP}(?:${MONTH}\\.?\\s*\\d{4}|${PRESENT})`, 'gi'),
  // Year – Year / Year – Present
  new RegExp(`\\b(?:19|20)\\d{2}${SEP}(?:(?:19|20)\\d{2}|${PRESENT})`, 'gi'),
  // MM/YYYY – MM/YYYY  (and . or - separators)
  new RegExp(`\\b\\d{1,2}[\\/.\\-]\\d{4}${SEP}(?:\\d{1,2}[\\/.\\-]\\d{4}|${PRESENT})`, 'gi'),
  // single Month Year
  new RegExp(`${MONTH}\\.?\\s*\\d{4}`, 'gi'),
  // single MM/YYYY
  new RegExp(`\\b\\d{1,2}[\\/.\\-]\\d{4}\\b`, 'gi'),
];

// Return up to `cap` distinct date strings, verbatim and in first-seen order.
export function extractDateStrings(text, cap = 25) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  for (const re of DATE_PATTERNS) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      const raw = m[0].replace(/\s+/g, ' ').trim();
      const key = raw.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(raw);
        if (out.length >= cap) return out;
      }
    }
  }
  return out;
}

// Reduce each date string to a shape signature (digits→9, letters→a) so two
// strings that differ only in their values collapse to one shape. More than one
// distinct shape across the CV means the candidate mixes date formats — a real,
// quotable inconsistency the teaser can surface.
export function dateFormatShapes(dates) {
  const shapes = new Set();
  for (const d of dates || []) {
    const shape = d
      .toLowerCase()
      .replace(/[a-z]+/g, 'a')
      .replace(/\d+/g, '9')
      .replace(/\s+/g, ' ')
      .trim();
    shapes.add(shape);
  }
  return [...shapes];
}

// --- COLUMN DETECTION ------------------------------------------------------
// Detect how many vertical text columns a page has from the horizontal extent
// of its text items. A single-column CV fills the middle of the page with long
// lines; a two-column CV leaves a vertical gutter — an empty vertical band in
// the middle third with substantial text on BOTH sides. We aggregate horizontal
// occupancy across the whole page: a persistent empty middle band can only be a
// gutter, because single-column body lines would cross it.
//
// `items` is [{ x, w }] in PDF user-space units; `pageWidth` is the page width
// in the same units. Returns an integer column count (1..3); 1 when uncertain.
export function detectColumns(items, pageWidth) {
  if (!Array.isArray(items) || items.length < 12 || !pageWidth || pageWidth <= 0) {
    return 1;
  }
  const BINS = 40;
  const occ = new Array(BINS).fill(0);
  for (const it of items) {
    const x0 = Math.max(0, it.x);
    const x1 = Math.min(pageWidth, it.x + (it.w || 0));
    if (x1 <= x0) {
      // zero-width item: mark its single bin
      const b = Math.min(BINS - 1, Math.floor((x0 / pageWidth) * BINS));
      occ[b] += 1;
      continue;
    }
    const b0 = Math.min(BINS - 1, Math.floor((x0 / pageWidth) * BINS));
    const b1 = Math.min(BINS - 1, Math.floor((x1 / pageWidth) * BINS));
    for (let b = b0; b <= b1; b++) occ[b] += 1;
  }

  // Count contiguous occupied "bands" separated by empty gutters that fall in
  // the central region of the page (ignore the normal empty left/right margins).
  const MARGIN = Math.round(BINS * 0.12); // ~12% page-edge margin, not a gutter
  const occupied = occ.map((c) => c > 0);
  let bands = 0;
  let inBand = false;
  let gutterRun = 0;
  for (let b = MARGIN; b < BINS - MARGIN; b++) {
    if (occupied[b]) {
      if (!inBand) {
        bands += 1;
        inBand = true;
      }
      gutterRun = 0;
    } else {
      gutterRun += 1;
      // a gutter must be a real gap (>=2 bins, ~5% of width) to split columns
      if (gutterRun >= 2) inBand = false;
    }
  }
  // Require both sides to carry real text before calling it multi-column.
  if (bands >= 2) {
    const half = Math.floor(BINS / 2);
    const left = occ.slice(0, half).reduce((a, c) => a + c, 0);
    const right = occ.slice(half).reduce((a, c) => a + c, 0);
    const total = left + right;
    if (total > 0 && left / total > 0.15 && right / total > 0.15) {
      return Math.min(3, bands);
    }
  }
  return 1;
}

// --- PROMPT NOTE -----------------------------------------------------------
// Render the layout sidecar as a short, plain note appended to the teaser CV
// input. Only lines that carry real signal are emitted. Returns '' when there
// is no layout (so the teaser falls back to text-only cleanly).
export function formatLayoutForPrompt(layout) {
  if (!layout || typeof layout !== 'object') return '';
  const lines = [];

  const fmt = (layout.format || 'file').toUpperCase();
  const pageStr = layout.pages ? `, ${layout.pages} page${layout.pages === 1 ? '' : 's'}` : '';
  lines.push(`- Format: ${fmt}${pageStr}.`);

  if (layout.likely_scanned) {
    lines.push('- Machine-readable text: NO — very little extractable text was found, so this is likely a scanned or image-based CV that an ATS cannot parse at all.');
  }

  if (layout.multi_column) {
    if (layout.format === 'docx' && layout.has_tables) {
      lines.push('- Layout: built with TABLES — many ATS parsers read table cells out of order, interleaving unrelated lines.');
    } else {
      const n = layout.columns && layout.columns > 1 ? layout.columns : 2;
      lines.push(`- Layout: ${n}-column — an ATS that reads top-to-bottom will interleave the columns and scramble the text order.`);
    }
  }

  if (layout.has_images && !layout.likely_scanned) {
    lines.push('- Contains embedded image(s)/graphic(s), which some parsers drop.');
  }

  if (Array.isArray(layout.date_formats) && layout.date_formats.length) {
    const quoted = layout.date_formats.slice(0, 6).map((d) => `"${d}"`).join(', ');
    const mixed = layout.mixed_date_formats ? ' (MIXED formats — the CV is not consistent)' : '';
    lines.push(`- Date strings exactly as written: ${quoted}${mixed}.`);
  }

  if (lines.length === 0) return '';
  return `LAYOUT SIGNAL — how the FILE ITSELF parses (judge the ATS gate and the buried-credential read against THIS; it is signal the plain text alone cannot show):\n${lines.join('\n')}`;
}
