// ===== File: /js/upload.js =====
class DocumentUpload {
  constructor() {
    this.dropZone = document.getElementById('drop-zone');
    this.fileInput = document.getElementById('file-input');
    this.analyzeBtn = document.getElementById('analyze-btn');
    this.reviewSection = document.getElementById('review-section');
    this.reviewOutput = document.getElementById('review-output');
    this.currentFile = null;
    this.setupListeners();
  }

  setupListeners() {
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      this.dropZone.classList.add('drag-over');
    });
    ['dragleave', 'dragend'].forEach(evt =>
      this.dropZone.addEventListener(evt, () => this.dropZone.classList.remove('drag-over'))
    );
    this.dropZone.addEventListener('drop', e => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
      this.handleFile(e.dataTransfer.files[0]);
    });
    this.fileInput.addEventListener('change', () => this.handleFile(this.fileInput.files[0]));
    this.analyzeBtn.addEventListener('click', () => this.runAnalysis());
  }

  handleFile(file) {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (!file || !allowed.includes(file.type)) {
      return alert('Please upload a PDF or Word document');
    }
    if (file.size > 5 * 1024 * 1024) {
      return alert('File must be less than 5MB');
    }
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
      // extract plain text from PDF/Word
      const text = await this.extractText(this.currentFile);

      // send as JSON to your API route
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, documentType: 'cv_file' })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `Analyze failed: ${res.status}`);
      }

      // display feedback
      this.reviewSection.classList.remove('hidden');
      this.reviewOutput.innerHTML = result.feedback
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      this.analyzeBtn.disabled = false;
      this.analyzeBtn.textContent = 'Analyze CV';
    }
  }

  async extractText(file) {
    if (file.type === 'application/pdf') {
      if (!window.pdfjsLib) {
        await this.loadScript(
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
          'pdfjsLib'
        );
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      }
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      return text.trim();
    } else {
      if (!window.mammoth) {
        await this.loadScript(
          'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.0/mammoth.browser.min.js',
          'mammoth'
        );
      }
      const buf = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
      return result.value.trim();
    }
  }

  loadScript(src, varName) {
    return new Promise((resolve, reject) => {
      if (window[varName]) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(s);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new DocumentUpload());
