import pdf from 'pdf-parse/lib/pdf-parse.js'
import { detectColumns } from './cvLayout.js'

// Plain text only — unchanged contract for any caller that just wants the text.
export default async function extractTextFromPDF(buffer) {
  const data = await pdf(buffer)
  return data.text
}

// Text + a best-effort LAYOUT SIGNAL sidecar (page count, column count derived
// from the horizontal position of text items, and whether the file is likely a
// scanned image with no real machine-readable text). Heuristic by design — the
// teaser uses it to judge the ATS gate against the real document.
//
// Robustness rule: layout capture must NEVER break an upload. Any failure inside
// the custom page renderer falls back to plain `data.text` with `layout: null`,
// and the caller treats a null layout as "text only".
export async function extractPdfWithLayout(buffer) {
  const perPage = [] // [{ items: [{ x, w }], width, textLen }]
  let renderFailed = false

  // pdf-parse builds the document text from whatever each pagerender returns, so
  // we both reconstruct readable text AND capture per-item x positions here.
  async function pagerender(pageData) {
    try {
      // Page width: prefer the raw MediaBox (`view`) which is stable across the
      // bundled pdfjs version; fall back to a viewport if absent.
      let pageWidth = 0
      if (Array.isArray(pageData.view) && pageData.view.length >= 4) {
        pageWidth = pageData.view[2] - pageData.view[0]
      } else if (typeof pageData.getViewport === 'function') {
        const vp = pageData.getViewport({ scale: 1.0 })
        pageWidth = vp?.width || 0
      }

      const content = await pageData.getTextContent()
      const raw = content.items || []
      const items = raw.map((it) => ({
        x: it.transform?.[4] ?? 0,
        y: it.transform?.[5] ?? 0,
        w: it.width || 0,
        str: it.str || '',
      }))

      // Reading-order-ish reconstruction: top-to-bottom, then left-to-right.
      // For a multi-column page this interleaves the columns — which is exactly
      // what a naive ATS does, so the teaser sees the same scramble it would.
      const sorted = [...items].sort((a, b) => {
        if (Math.abs(a.y - b.y) > 2) return b.y - a.y
        return a.x - b.x
      })
      const lines = []
      let cur = null
      let curY = null
      for (const it of sorted) {
        if (curY === null || Math.abs(it.y - curY) > 2) {
          if (cur !== null) lines.push(cur)
          cur = it.str
          curY = it.y
        } else {
          const join = cur.endsWith(' ') || it.str.startsWith(' ') ? '' : ' '
          cur += join + it.str
        }
      }
      if (cur !== null) lines.push(cur)
      const text = lines.join('\n')

      perPage.push({
        items: items.map(({ x, w }) => ({ x, w })),
        width: pageWidth,
        textLen: text.replace(/\s/g, '').length,
      })
      return text + '\n\n'
    } catch (e) {
      renderFailed = true
      return ''
    }
  }

  let data
  try {
    data = await pdf(buffer, { pagerender })
  } catch (e) {
    // Total parse failure under the custom renderer — retry plain so the caller
    // still gets text (or a real CvFileError from the plain path upstream).
    const plain = await pdf(buffer)
    return { text: plain.text, layout: null }
  }

  if (renderFailed || perPage.length === 0) {
    return { text: data.text, layout: null }
  }

  let columns = 1
  for (const p of perPage) columns = Math.max(columns, detectColumns(p.items, p.width))
  const pages = data.numpages || perPage.length
  const textChars = perPage.reduce((n, p) => n + p.textLen, 0)

  const layout = {
    format: 'pdf',
    pages,
    columns,
    multi_column: columns > 1,
    text_chars: textChars,
    // A real text CV carries well over 80 non-space chars per page; far less
    // means the pages are mostly image with no parseable text.
    likely_scanned: pages > 0 && textChars / pages < 80,
  }

  return { text: data.text, layout }
}
