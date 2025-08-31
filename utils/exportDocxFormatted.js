// utils/exportDocxFormatted.js
// Keeps each block (job, education, etc.) intact on one page without forced breaks

import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  TabStopType,
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
    tabStop: { type: TabStopType.LEFT, position: 4500 },
    underline: { text: '________________________________', size: 16, color: 'e6e6e6' },
  };

  const lines = markdownText.split('\n');
  const docParagraphs = [];
  let currentSectionTitle = '';
  let inCenterBlock = false;
  let inJobBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    if (raw.includes('<center>')) { inCenterBlock = true; continue; }
    if (raw.includes('</center>')) {
      inCenterBlock = false;
      docParagraphs.push(new Paragraph({ spacing: { after: 400 }, keepLines: true, keepNext: false }));
      continue;
    }

    if (inCenterBlock) {
      const cleaned = raw.replace(/\*\*|<\/?strong[^>]*>|\*/g, '').replace(/^#+\s*/, '');
      if (raw.startsWith('#')) {
        docParagraphs.push(new Paragraph({
          children: [new TextRun({ text: cleaned, ...styles.name })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 150 },
          keepLines: true,
          keepNext: false,
        }));
      } else {
        const isContact = cleaned.includes('@') || cleaned.includes('|') || /linkedin|www\./.test(cleaned);
        docParagraphs.push(new Paragraph({
          children: [new TextRun({ text: cleaned, ...(isContact ? styles.contact : styles.tagline) })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          keepLines: true,
          keepNext: false,
        }));
      }
      continue;
    }

    if (raw === '---') continue;

    if (raw.startsWith('#') && /experience/i.test(currentSectionTitle)) {
      const cleaned = raw.replace(/^#+\s*/, '').replace(/\*+/g, '').trim();
      inJobBlock = true;
      docParagraphs.push(new Paragraph({
        children: [new TextRun({ text: cleaned, ...styles.jobTitle })],
        spacing: { before: 300, after: 100 },
        keepLines: true,
        keepNext: true,
      }));
      continue;
    }

    if (raw.startsWith('###')) {
      currentSectionTitle = raw.replace(/###\s*\**|\**/g, '').trim();
      inJobBlock = false;

      docParagraphs.push(new Paragraph({
        children: [new TextRun(styles.underline)],
        spacing: { before: 400, after: 200 },
        keepLines: true,
        keepNext: true,
      }));

      const isSafeBreakSection = /(Education|Certifications|Languages)/i.test(currentSectionTitle);

      docParagraphs.push(new Paragraph({
        children: [new TextRun({ text: currentSectionTitle, ...styles.sectionHeader })],
        spacing: { after: 150 },
        keepLines: true,
        keepNext: false,
        pageBreakBefore: isSafeBreakSection,
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

        for (let k = 0; k < skillsBuffer.length; k += 2) {
          const leftSkill = skillsBuffer[k] || '';
          const rightSkill = skillsBuffer[k + 1] || '';
          const children = [];
          if (leftSkill) {
            children.push(new TextRun({ text: '• ', ...styles.skillText }));
            children.push(new TextRun({ text: leftSkill, ...styles.skillText }));
          }
          if (rightSkill) {
            children.push(new TextRun({ text: '\t' }));
            children.push(new TextRun({ text: '• ', ...styles.skillText }));
            children.push(new TextRun({ text: rightSkill, ...styles.skillText }));
          }
          docParagraphs.push(new Paragraph({
            children,
            tabStops: [styles.tabStop],
            spacing: { after: 150 },
            keepLines: true,
            keepNext: true,
          }));
        }
        continue;
      }
      continue;
    }

    const cleaned = raw.replace(/\*\*|<\/?strong[^>]*>|\*/g, '').replace(/^- |^• /, '').replace(/<\/?li>/gi, '');

    if (raw.includes('|') && /experience|education/i.test(currentSectionTitle)) {
      inJobBlock = true;
      const parts = cleaned.split('|').map(p => p.trim());
      const children = [new TextRun({ text: parts[0], ...styles.company })];
      if (parts[1]) children.push(new TextRun({ text: ` | ${parts[1]}`, ...styles.dates }));
      if (parts[2]) children.push(new TextRun({ text: ` | ${parts[2]}`, ...styles.dates }));
      docParagraphs.push(new Paragraph({
        children,
        spacing: { after: 200 },
        keepLines: true,
        keepNext: true,
      }));
      continue;
    }

    if (raw.startsWith('- ') || raw.startsWith('• ') || /^<li>.*<\/li>$/i.test(raw)) {
      inJobBlock = true;
      docParagraphs.push(new Paragraph({
        children: [
          new TextRun({ text: '• ', ...styles.bulletText }),
          new TextRun({ text: cleaned, ...styles.bulletText }),
        ],
        spacing: { after: 150 },
        indent: { left: 360, hanging: 360 },
        keepLines: true,
        keepNext: true,
      }));
      continue;
    }

    if (cleaned) {
      docParagraphs.push(new Paragraph({
        children: [new TextRun({ text: cleaned, ...styles.bodyText })],
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
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children: docParagraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${type}-${user_id}.docx`;
  saveAs(blob, filename);
}
