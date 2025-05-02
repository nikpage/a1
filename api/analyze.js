// ===== File: index.html =====
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CVPro Review Tool</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>AI CV Review</h1>
      <p class="subtitle">Get professional feedback on your resume</p>
    </header>
    <main>
      <section id="upload-section">
        <div class="upload-container">
          <div id="drop-zone" class="upload-box">
            <input type="file" id="file-input" accept=".pdf,.docx,.doc">
            <div class="drop-zone-content">
              <span class="drop-zone-icon">📁</span>
              <span class="drop-zone-text">Drag & drop your CV here</span>
              <span class="drop-zone-secondary">or click to browse</span>
            </div>
          </div>
          <button id="analyze-btn" disabled>Analyze CV</button>
        </div>
      </section>
      <section id="review-section" class="hidden">
        <h2>AI Review Results</h2>
        <div id="review-output" class="review-output"></div>
      </section>
    </main>
  </div>
  <!-- Only client scripts needed: upload and app -->
  <script src="/js/upload.js"></script>
  <script src="/js/app.js"></script>
</body>
</html>


// ===== File: /api/analyze.js =====
import { KeyManager } from '../js/key-manager.js';
const km = new KeyManager();
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const { text, documentType } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });
    const apiKey = km.keys[0];
    if (!apiKey) throw new Error('DeepSeek API key missing');
    const apiRes = await fetch('https://api.deepseek.com/v1/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ text, documentType })
    });
    if (!apiRes.ok) {
      const errTxt = await apiRes.text();
      throw new Error(`DeepSeek error ${apiRes.status}: ${errTxt}`);
    }
    const { feedback, usage } = await apiRes.json();
    km.trackUsage(usage);
    return res.status(200).json({ feedback });
  } catch (err) {
    console.error('API /analyze error:', err);
    return res.status(500).json({ error: err.message });
  }
}


// ===== File: /js/upload.js =====
class DocumentUpload {
  constructor() {
    this.dropZone = document.getElementById('drop-zone');
    this.fileInput = document.getElementById('file-input');
    this.analyzeBtn = document.getElementById('analyze-btn');
    this.reviewSection = document.getElementById('review-section');
    this.reviewOutput = document.getElementById('review-output');
    this.currentFile = null;
    this.setup();
  }

  setup() {
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.dropZone.addEventListener('dragover', e => { e.preventDefault(); this.dropZone.classList.add('drag-over'); });
    ['dragleave','dragend'].forEach(ev => this.dropZone.addEventListener(ev, () => this.dropZone.classList.remove('drag-over')));
    this.dropZone.addEventListener('drop', e => { e.preventDefault(); this.dropZone.classList.remove('drag-over'); this.handleFile(e.dataTransfer.files[0]); });
    this.fileInput.addEventListener('change', () => this.handleFile(this.fileInput.files[0]));
    this.analyzeBtn.addEventListener('click', () => this.runAnalysis());
  }

  handleFile(file) {
    const types = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (!file || !types.includes(file.type)) return alert('Upload a PDF or Word file');
    if (file.size > 5 * 1024 * 1024) return alert('File must be <5MB');
    this.currentFile = file;
    this.analyzeBtn.disabled = false;
    this.dropZone.querySelector('.drop-zone-text').textContent = file.name;
    this.dropZone.querySelector('.drop-zone-secondary').textContent = `${(file.size/1024/1024).toFixed(2)} MB`;
  }

  async runAnalysis() {
    if (!this.currentFile) return;
    this.analyzeBtn.disabled = true;
    this.analyzeBtn.textContent = 'Analyzing...';
    try {
      // Build form data instead of JSON
      const form = new FormData();
      form.append('file', this.currentFile);
      form.append('documentType', 'cv_file');

      // Direct call to DeepSeek with file upload
      const res = await fetch('https://api.deepseek.com/v1/analyze', {
        method: 'POST',
        headers: { 'Authorization': `Bearer YOUR_DEEPSEEK_KEY` },
        body: form
      });
      if (!res.ok) throw new Error(`Analyze failed: ${res.status}`);
      const { feedback } = await res.json();
      this.reviewSection.classList.remove('hidden');
      this.reviewOutput.innerHTML = feedback
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/
/g, '<br>');
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      this.analyzeBtn.disabled = false;
      this.analyzeBtn.textContent = 'Analyze CV';
    }
  }
  }

  async extractText(file) {
    if (file.type === 'application/pdf') {
      if (!window.pdfjsLib) {
        await this.load('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js', 'pdfjsLib');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      }
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      let txt = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        txt += content.items.map(item => item.str).join(' ') + '
';
      }
      return txt.trim();
    } else {
      if (!window.mammoth) await this.load('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.0/mammoth.browser.min.js', 'mammoth');
      const buf = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
      return result.value.trim();
    }
  }

  load(src, varName) {
    return new Promise((resolve, reject) => {
      if (window[varName]) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new DocumentUpload());
