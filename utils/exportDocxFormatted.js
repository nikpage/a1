// utils/exportDocxFormatted.js

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
  ShadingType,
  UnderlineType,
  TabStopPosition,
  TabStopType,
  Header,
  Footer,
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
  let currentSection = '';

  // Define consistent styling
  const styles = {
    name: { size: 32, bold: true, color: '1f4e79' }, // Professional blue
    tagline: { size: 24, bold: false, color: '5b9bd5', italics: true },
    contact: { size: 20, color: '404040' },
    sectionHeader: { size: 26, bold: true, color: '1f4e79' },
    jobTitle: { size: 24, bold: true, color: '2d2d2d' },
    company: { size: 22, bold: true, color: '5b5b5b' },
    dates: { size: 20, color: '7f7f7f', italics: true },
    bodyText: { size: 22, color: '2d2d2d' },
    bulletText: { size: 22, color: '2d2d2d' },
    skillText: { size: 21, color: '2d2d2d' },
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();

    if (raw === '---') {
      // Add section spacing
      docParagraphs.push(new Paragraph({ spacing: { after: 300 } }));
      continue;
    }

    // Track center blocks
    if (raw.includes('<center>')) {
      inCenterBlock = true;
      continue;
    }
    if (raw.includes('</center>')) {
      inCenterBlock = false;
      // Add spacing after header section
      docParagraphs.push(new Paragraph({ spacing: { after: 400 } }));
      continue;
    }

    // Handle skills section
    if (raw.startsWith('<div') || raw === '</div>') {
      if (raw.includes('display: flex')) {
        inSkillsSection = true;
      } else if (raw === '</div>' && inSkillsSection) {
        // Create professional two-column skills table
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
                      children: leftSkill ? [
                        new TextRun({ text: '• ', ...styles.skillText }),
                        new TextRun({ text: leftSkill, ...styles.skillText })
                      ] : [],
                      spacing: { after: 120 },
                    })],
                    width: { size: 48, type: WidthType.PERCENTAGE },
                    margins: { top: 100, bottom: 100, left: 0, right: 200 },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      children: rightSkill ? [
                        new TextRun({ text: '• ', ...styles.skillText }),
                        new TextRun({ text: rightSkill, ...styles.skillText })
                      ] : [],
                      spacing: { after: 120 },
                    })],
                    width: { size: 48, type: WidthType.PERCENTAGE },
                    margins: { top: 100, bottom: 100, left: 200, right: 0 },
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

    // Clean markdown formatting
    const cleaned = raw
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/<\/?strong[^>]*>/g, '')
      .replace(/^• /, '')
      .replace(/^- /, '');

    // Handle different content types
    if (raw.startsWith('### **') && inCenterBlock) {
      // Name in header
      const nameText = cleaned.replace(/^### /, '').replace(/\*\*/g, '');
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: nameText, ...styles.name })],
          spacing: { after: 200 },
          alignment: AlignmentType.CENTER,
        })
      );
    } else if (inCenterBlock && cleaned && !cleaned.startsWith('#')) {
      // Contact info and taglines in header
      const isContactInfo = cleaned.includes('@') || cleaned.includes('|') || cleaned.includes('linkedin') || cleaned.includes('www.');
      const style = isContactInfo ? styles.contact : styles.tagline;

      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: cleaned, ...style })],
          spacing: { after: 150 },
          alignment: AlignmentType.CENTER,
        })
      );
    } else if (raw.startsWith('### **')) {
      // Section headers
      currentSection = cleaned.replace(/^### /, '').replace(/\*\*/g, '');
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: currentSection, ...styles.sectionHeader }),
          ],
          spacing: { before: 400, after: 200 },
          alignment: AlignmentType.LEFT,
        })
      );

      // Add underline for section headers
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: '________________________________', size: 16, color: 'e6e6e6' })],
          spacing: { after: 300 },
          alignment: AlignmentType.LEFT,
        })
      );
    } else if (raw.startsWith('#### **')) {
      // Job titles - most prominent
      const jobTitle = cleaned.replace(/^#### /, '').replace(/\*\*/g, '');
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: jobTitle, ...styles.jobTitle })],
          spacing: { before: 300, after: 100 },
          alignment: AlignmentType.LEFT,
        })
      );
    } else if (raw.startsWith('**') && raw.includes('|') && currentSection === 'Professional Experience') {
      // Company, dates, location line
      const parts = cleaned.replace(/\*\*/g, '').split('|').map(p => p.trim());
      const children = [];

      if (parts[0]) {
        children.push(new TextRun({ text: parts[0], ...styles.company }));
      }

      if (parts[1]) {
        children.push(new TextRun({ text: ' | ', ...styles.dates }));
        children.push(new TextRun({ text: parts[1], ...styles.dates }));
      }

      if (parts[2]) {
        children.push(new TextRun({ text: ' | ', ...styles.dates }));
        children.push(new TextRun({ text: parts[2], ...styles.dates }));
      }

      docParagraphs.push(
        new Paragraph({
          children: children,
          spacing: { after: 200 },
          alignment: AlignmentType.LEFT,
        })
      );
    } else if (inSkillsSection && (raw.startsWith('- ') || raw.startsWith('• '))) {
      // Collect skills for two-column layout
      skillsBuffer.push(cleaned);
    } else if (raw.startsWith('- ') || raw.startsWith('• ')) {
      // Regular bullet points with better formatting
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ', ...styles.bulletText }),
            new TextRun({ text: cleaned, ...styles.bulletText })
          ],
          spacing: { after: 150 },
          alignment: AlignmentType.LEFT,
          indent: { left: 360, hanging: 360 }, // Proper bullet indent
        })
      );
    } else if (raw === '') {
      // Skip empty lines - spacing is handled by paragraph spacing
      continue;
    } else if (cleaned && !cleaned.startsWith('#')) {
      // Regular paragraphs
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: cleaned, ...styles.bodyText })],
          spacing: { after: 200 },
          alignment: AlignmentType.LEFT,
        })
      );
    }
  }

  // Create document with professional styling
  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          baseCharacterStyle: {
            font: "Calibri",
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing
            },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docParagraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${type}-${user_id}.docx`;
  saveAs(blob, filename);
}
