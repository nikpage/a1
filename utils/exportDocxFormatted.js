import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
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

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();

    if (raw === '---') continue;

    const cleaned = raw
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^• /, '')
      .replace(/^- /, '');

    const nextLine = lines[i + 1]?.trim() || '';

    const isH2 = raw.startsWith('### ');
    const isH1 = raw.startsWith('## ');

    if (isH2) {
      docParagraphs.push(
        new Paragraph({
          text: cleaned.replace(/^### /, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 100, after: 150 },
          alignment: AlignmentType.LEFT,
        })
      );
    } else if (isH1) {
      docParagraphs.push(
        new Paragraph({
          text: cleaned.replace(/^## /, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 100, after: 150 },
          alignment: AlignmentType.LEFT,
        })
      );
    } else if (raw.startsWith('- ') || raw.startsWith('• ')) {
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
    } else {
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: cleaned, size: 24 })],
          spacing: { after: 150 },
          alignment: AlignmentType.LEFT,
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
