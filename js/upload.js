<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV Upload & Submit</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    button, input, textarea { display: block; margin: 10px 0; padding: 8px; }
    #feedback, #result { margin-top: 20px; white-space: pre-wrap; background: #f9f9f9; padding: 10px; }
  </style>
</head>
<body>
  <h1>CV Upload & Metadata</h1>

  <input type="file" id="file-input" accept=".pdf,.doc,.docx" />
  <button type="button" id="analyze-btn" disabled>Analyze CV</button>

  <div id="feedback"></div>

  <!-- Metadata fields -->
  <input type="text" id="meta-name" placeholder="Name" disabled />
  <input type="email" id="meta-email" placeholder="Email" disabled />
  <textarea id="meta-notes" placeholder="Notes" rows="3" disabled></textarea>
  <button type="button" id="submit-btn" onclick="submitMetadata()">Submit Metadata</button>
  <div id="result"></div>

  <!-- Dependencies for PDF and DOCX parsing -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
  </script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.20/mammoth.browser.min.js"></script>

  <script>
    let parsedText = '';
    const fileInput = document.getElementById('file-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const feedback = document.getElementById('feedback');
    const submitBtn = document.getElementById('submit-btn');
    const result = document.getElementById('result');
    const metaName = document.getElementById('meta-name');
    const metaEmail = document.getElementById('meta-email');
    const metaNotes = document.getElementById('meta-notes');

    fileInput.addEventListener('change', () => {
      analyzeBtn.disabled = !fileInput.files.length;
      feedback.textContent = '';
      resetMetadata();
      result.textContent = '';
    });

    analyzeBtn.addEventListener('click', async () => {
      const file = fileInput.files[0]; if (!file) return;
      feedback.textContent = 'Extracting text...';
      try {
        parsedText = await extractText(file);
        feedback.textContent = 'Extracted Text:\n' + parsedText.slice(0, 500) + (parsedText.length > 500 ? '...' : '');
        enableMetadata();
      } catch (err) {
        feedback.textContent = 'Error extracting text: ' + err.message;
      }
    });

    // Central submission function
    async function submitMetadata() {
      console.log('submitMetadata called');
      result.textContent = 'Submitting...';
      const payload = {
        cv_body: parsedText,
        name: metaName.value.trim(),
        email: metaEmail.value.trim(),
        notes: metaNotes.value.trim()
      };
      try {
        const res = await fetch('/api/second-stage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        result.textContent = 'Server Response:\n' + JSON.stringify(data, null, 2);
      } catch (err) {
        result.textContent = 'Error submitting: ' + err.message;
      }
    }

    // Attach fallback in JS as well
    submitBtn.addEventListener('click', submitMetadata);

    function enableMetadata() {
      metaName.disabled = metaEmail.disabled = metaNotes.disabled = submitBtn.disabled = false;
    }
    function resetMetadata() {
      metaName.value = metaEmail.value = metaNotes.value = '';
      metaName.disabled = metaEmail.disabled = metaNotes.disabled = submitBtn.disabled = true;
    }

    async function extractText(file) {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => item.str).join(' ') + '\n';
        }
        return fullText.trim();
      } else if (file.name.match(/\.docx?$/)) {
        const arrayBuffer = await file.arrayBuffer();
        const resultRead = await mammoth.extractRawText({ arrayBuffer });
        return resultRead.value.trim();
      } else {
        return new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.onerror = () => rej(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      }
    }
  </script>
</body>
</html>
