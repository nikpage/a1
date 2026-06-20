// utils/exportDocxFormatted.js


import { saveAs } from 'file-saver';
import {
Document,
Packer,
Paragraph,
TextRun,
AlignmentType,
BorderStyle,
} from 'docx';

export default async function exportDocxFormatted({
type = 'cv',
user_id = 'user',
markdownText = '',
}) {
if (!markdownText) {
alert('Nothing to export.');
return;
}

const styles = {
name: { size: 32, bold: true, color: '1f4e79' },
tagline: { size: 24, color: '5b9bd5', italics: true },
contact: { size: 20, color: '404040' },
sectionHeader: { size: 26, bold: true, color: '1f4e79' },
jobTitle: { size: 24, bold: true, color: '2d2d2d' },
company: { size: 22, bold: true, color: '5b5b5b' },
dates: { size: 20, color: '7f7f7f', italics: true },
bodyText: { size: 22, color: '2d2d2d' },
bulletText: { size: 22, color: '2d2d2d' },
skillText: { size: 21, color: '2d2d2d' },
// ATS-safe section divider: a real bottom border, never literal underscore text
// (a row of "____" is ingested by ATS parsers as a meaningless token).
rule: { style: BorderStyle.SINGLE, size: 4, space: 1, color: 'CCCCCC' },
};

// Normalise AI output to clean markdown before line-by-line parsing.
// The AI (Gemini) can vary its output format — this ensures the parser only
// ever sees markdown + the three known special tags: <center>, </center>, <!--.
function normaliseToMarkdown(text) {
  return text
    // headings: <h1>…</h6> → markdown #
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1')
    // bold/italic
    .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*')
    // list items → markdown bullets (before stripping <ul>/<ol>)
    .replace(/<li[^>]*>(.*?)<\/li>/gi, (_, inner) => `- ${inner.replace(/<[^>]+>/g, '').trim()}`)
    // block-level wrappers → newlines so content isn't run together
    .replace(/<\/?(ul|ol|div|section|article|header|footer|nav|aside|main)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
    // strip all remaining HTML tags (preserves <center>, </center>, <!-- which don't match these)
    .replace(/<(?!\/?(center)\b)(?!--)[^>]+>/gi, '')
    // decode common HTML entities
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    // collapse runs of blank lines to at most two
    .replace(/\n{3,}/g, '\n\n');
}

// Split a line into TextRuns, rendering inline **bold** / *italic* as real
// formatting instead of stripping the markers. Falls back to a single run.
function makeRuns(text, baseStyle) {
  const runs = [];
  const inline = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m;
  while ((m = inline.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index), ...baseStyle }));
    }
    const tok = m[0];
    if (tok.startsWith('**')) {
      runs.push(new TextRun({ text: tok.slice(2, -2), ...baseStyle, bold: true }));
    } else {
      runs.push(new TextRun({ text: tok.slice(1, -1), ...baseStyle, italics: true }));
    }
    last = inline.lastIndex;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), ...baseStyle }));
  }
  return runs.length ? runs : [new TextRun({ text, ...baseStyle })];
}

const lines = normaliseToMarkdown(markdownText).split('\n');
const docParagraphs = [];
let currentSectionTitle = '';
let inCenterBlock = false;
let inJobBlock = false;

for (let i = 0; i < lines.length; i++) {
const raw = lines[i].trim();
if (!raw) continue;

// Strip layout-only markup so it can never leak into the .docx as literal text.
if (raw.startsWith('<!--')) continue;
if (/^<\/?(div|ul|ol)\b/i.test(raw)) continue;
// Skip any line that is purely an HTML tag (e.g. stray <p>, <br/>, <span ...>)
if (/^<[^>]+>$/.test(raw)) continue;

if (raw.includes('<center>')) { inCenterBlock = true; continue; }
if (raw.includes('</center>')) {
  inCenterBlock = false;
  docParagraphs.push(new Paragraph({ spacing: { after: 100 }, keepLines: true}));
  continue;
}

if (inCenterBlock) {
  const cleaned = raw.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
  if (raw.startsWith('#')) {
    docParagraphs.push(new Paragraph({
      children: [new TextRun({ text: cleaned, ...styles.name })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      keepLines: true,

    }));
  } else {
    const isContact = cleaned.includes('@') || cleaned.includes('|') || /linkedin|www\./.test(cleaned);
    docParagraphs.push(new Paragraph({
      children: [new TextRun({ text: cleaned, ...(isContact ? styles.contact : styles.tagline) })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      keepLines: true,

    }));
  }
  continue;
}

if (raw === '---') continue;

// Top-level name heading. Normally the AI wraps the intro in <center>, but
// when it omits that wrapper a bare "# Name" must still render centered as the
// name — never leak the literal "#" into the document.
if (/^#\s+/.test(raw)) {
  const nm = raw
    .replace(/<[^>]+>/g, '')
    .replace(/^#+\s*/, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .trim();
  docParagraphs.push(new Paragraph({
    children: [new TextRun({ text: nm, ...styles.name })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 150 },
    keepLines: true,
  }));
  // The AI omitted the <center> wrapper, so the tagline + contact lines that
  // follow the bare name would otherwise fall through to left-aligned body
  // text — a centered name over a left-aligned header looks broken. Center the
  // header lines up to the first section (###) / divider (---), capped so a
  // missing section header can't swallow the whole document.
  let h = i + 1;
  while (h < lines.length && h - i <= 3) {
    const hl = lines[h].trim();
    if (!hl) { h++; continue; }
    if (/^#{1,3}\s/.test(hl) || hl === '---' || /<\/?center>/i.test(hl)) break;
    const hlClean = hl
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
      .replace(/\*\*/g, '').replace(/\*/g, '')
      .replace(/^#+\s*/, '').replace(/^- |^• /, '')
      .trim();
    if (!hlClean) { h++; continue; }
    const isContact = hlClean.includes('@') || hlClean.includes('|') || /linkedin|www\./.test(hlClean);
    docParagraphs.push(new Paragraph({
      children: [new TextRun({ text: hlClean, ...(isContact ? styles.contact : styles.tagline) })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      keepLines: true,
    }));
    h++;
  }
  i = h - 1;
  continue;
}

if (raw.startsWith('#### ') && /experience/i.test(currentSectionTitle)) {
  const cleaned = raw.replace(/<[^>]+>/g, '').replace(/^####\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
  inJobBlock = true;
  docParagraphs.push(new Paragraph({
    children: [new TextRun({ text: cleaned, ...styles.jobTitle })],
    spacing: { before: 200, after: 100 },
    keepLines: true,

  }));
  continue;
}

if (raw.startsWith('###')) {
  currentSectionTitle = raw.replace(/###\s*\**|\**/g, '').trim();
  inJobBlock = false;

  docParagraphs.push(new Paragraph({
    border: { bottom: styles.rule },
    spacing: { before: 100, after: 200 },
    keepLines: true,
  }));

  docParagraphs.push(new Paragraph({
    children: [new TextRun({ text: currentSectionTitle, ...styles.sectionHeader })],
    spacing: { after: 150 },
    keepLines: true,
    keepNext: true,
  }));
  if (/skills|competencies/i.test(currentSectionTitle)) {
    const skillsBuffer = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('###') && !lines[j].includes('---')) {
      const skillLine = lines[j].trim();
      if (skillLine.startsWith('- ') || skillLine.startsWith('• ')) {
        skillsBuffer.push(skillLine.replace(/^- |^• /, '').trim());
      } else if (/<li>.*<\/li>/i.test(skillLine)) {
        const match = skillLine.match(/<li>(.*?)<\/li>/gi);
        if (match) {
          match.forEach(m => {
            const extracted = m.replace(/<\/?li>/gi, '').trim();
            if (extracted) skillsBuffer.push(extracted);
          });
        }
      }
      j++;
    }
    i = j - 1;

    // One skill per line. A tab-separated two-column layout is read out of
    // order (or merged) by ATS parsers, so keep skills single-column.
    for (let k = 0; k < skillsBuffer.length; k++) {
      docParagraphs.push(new Paragraph({
        children: [
          new TextRun({ text: '• ', ...styles.skillText }),
          new TextRun({ text: skillsBuffer[k], ...styles.skillText }),
        ],
        spacing: { after: 80 },
        indent: { left: 360, hanging: 360 },
        keepLines: true,
      }));
    }
    continue;
  }
  continue;
}

// markdown-preserving: HTML stripped + entities decoded, but **bold**/*italic*
// markers kept so makeRuns() can turn them into real formatting.
const cleanedMd = raw
  .replace(/<[^>]+>/g, '')        // strip all HTML tags
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/^#+\s*/, '')          // strip any stray leading heading marker
  .replace(/^- |^• /, '')
  .trim();
// plain: emphasis markers removed too, for the pipe-delimited company line.
const cleaned = cleanedMd.replace(/\*\*/g, '').replace(/\*/g, '');

if (raw.includes('|') && /experience/i.test(currentSectionTitle) && inJobBlock) {
  const parts = cleaned.split('|').map(p => p.trim());
  const children = [new TextRun({ text: parts[0], ...styles.company })];
  if (parts[1]) children.push(new TextRun({ text: ` | ${parts[1]}`, ...styles.dates }));
  if (parts[2]) children.push(new TextRun({ text: ` | ${parts[2]}`, ...styles.dates }));
  docParagraphs.push(new Paragraph({
    children,
    spacing: { after: 200 },
    keepLines: true,

  }));
  continue;
}

if (raw.startsWith('- ') || raw.startsWith('• ') || /^<li>.*<\/li>$/i.test(raw)) {
  inJobBlock = true;
  docParagraphs.push(new Paragraph({
    children: [
      new TextRun({ text: '• ', ...styles.bulletText }),
      ...makeRuns(cleanedMd, styles.bulletText),
    ],
    spacing: { after: 150 },
    indent: { left: 360, hanging: 360 },
    keepLines: true,

  }));
  continue;
}

if (cleaned) {
  docParagraphs.push(new Paragraph({
    children: makeRuns(cleanedMd, styles.bodyText),
    spacing: { after: 200 },
    keepLines: true,
    keepNext: inJobBlock,
  }));
  inJobBlock = false;
}
}

const doc = new Document({
styles: {
paragraphStyles: [
{
id: "Normal",
name: "Normal",
basedOn: "Normal",
next: "Normal",
quickFormat: true,
run: { font: "Calibri", size: 22 },
paragraph: { spacing: { line: 276 }, widowControl: true },
},
],
},
sections: [
{
properties: {
page: { margin: { top: 1008, right: 1080, bottom: 1008, left: 1080 } },
},
children: docParagraphs,
},
],
});

const blob = await Packer.toBlob(doc);
const filename = `${type}-${user_id}.docx`;
saveAs(blob, filename);
}
