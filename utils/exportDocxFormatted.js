import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';

export default async function exportDocxWithDocxLib({
  type = 'cv',
  user_id = 'user',
  markdownText = '',
}) {
  if (!markdownText) {
    alert('Nothing to export.');
    return;
  }

  const lines = markdownText.split('\n');
  const docParagraphs = [];
  let inCenterBlock = false;
  let inSkillsSection = false;
  let skillsBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();

    if (raw === '---') continue;

    // Track center blocks
    if (raw.includes('<center>')) {
      inCenterBlock = true;
      continue;
    }
    if (raw.includes('</center>')) {
      inCenterBlock = false;
      continue;
    }

    // Skip div tags but track skills section
    if (raw.startsWith('<div') || raw === '</div>') {
      if (raw.includes('display: flex')) {
        inSkillsSection = true;
      } else if (raw === '</div>' && inSkillsSection) {
        // End of skills section - create two-column table
        if (skillsBuffer.length > 0) {
          const rows = [];
          for (let j = 0; j < skillsBuffer.length; j += 2) {
            const leftSkill = skillsBuffer[j] || '';
            const rightSkill = skillsBuffer[j + 1] || '';

            rows.push(
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: leftSkill, size: 24 })],
                    })],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      children: rightSkill ? [new TextRun({ text: rightSkill, size: 24 })] : [],
                    })],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                  }),
                ],
              })
            );
          }

          const skillsTable = new Table({
            rows: rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          });

          docParagraphs.push(skillsTable);
          skillsBuffer = [];
        }
        inSkillsSection = false;
      }
      continue;
    }

    const cleaned = raw
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/<\/?strong[^>]*>/g, '')
      .replace(/^• /, '')
      .replace(/^- /, '');

    const nextLine = lines[i + 1]?.trim() || '';

    // Handle different heading levels
    if (raw.startsWith('#### ')) {
      // Job titles - make them prominent
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: cleaned.replace(/^#### /, ''), size: 28, bold: true })],
          spacing: { before: 200, after: 100 },
          alignment: AlignmentType.LEFT,
        })
      );
    } else if (raw.startsWith('### ')) {
      // Section headers
      docParagraphs.push(
        new Paragraph({
          text: cleaned.replace(/^### /, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 150 },
          alignment: AlignmentType.LEFT,
        })
      );
    } else if (raw.startsWith('## ')) {
      docParagraphs.push(
        new Paragraph({
          text: cleaned.replace(/^## /, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 100, after: 150 },
          alignment: AlignmentType.LEFT,
        })
      );
    } else if (inSkillsSection && (raw.startsWith('- ') || raw.startsWith('• '))) {
      // Collect skills for two-column layout
      skillsBuffer.push(cleaned);
    } else if (raw.startsWith('- ') || raw.startsWith('• ')) {
      // Regular bullet points
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: cleaned, size: 24 })],
          bullet: { level: 0 },
          spacing: { after: 100 },
          alignment: AlignmentType.LEFT,
        })
      );
    } else if (raw === '') {
      if (!nextLine.startsWith('##') && !nextLine.startsWith('###')) {
        docParagraphs.push(new Paragraph({ spacing: { after: 100 } }));
      }
    } else if (cleaned) {
      // Regular text - center if in center block
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: cleaned, size: 24 })],
          spacing: { after: 150 },
          alignment: inCenterBlock ? AlignmentType.CENTER : AlignmentType.LEFT,
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        children: docParagraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${type}-${user_id}.docx`;
  saveAs(blob, filename);
}
