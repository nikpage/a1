// pages/api/download-doc.js

import { Document, Packer, Paragraph, TextRun } from 'docx';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, content } = req.body;

  if (!type || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const doc = new Document({
      sections: [
        {
          children: content.split('\n').map(line =>
            new Paragraph({
              children: [new TextRun(line)],
            })
          ),
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = type === 'cover' ? 'CoverLetter.docx' : 'CV.docx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to generate document' });
  }
}
