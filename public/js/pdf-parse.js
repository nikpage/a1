// /public/js/pdf-parse.js (fixed version)

import { getDocument } from 'pdfjs-dist';

export async function parsePDF(file) {
  const statusText = document.getElementById('statusText');

  try {
    if (!file) {
      throw new Error('No file provided.');
    }

    statusText.textContent = 'Parsing PDF...';

    const fileReader = new FileReader();

    return new Promise((resolve, reject) => {
      fileReader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);
          const pdf = await getDocument({ data: typedarray }).promise;
          let fullText = '';

          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            fullText += strings.join(' ') + '\n';
          }

          statusText.textContent = 'PDF
