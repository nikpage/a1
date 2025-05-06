// File: /js/upload.js
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
      this.selectFile(e.dataTransfer.files[0]);
    });
    this.fileInput.addEventListener('change', () => this.selectFile(this.fileInput.files[0]));
    this.analyzeBtn.addEventListener('click', () => this.runAnalysis());
  }

  selectFile(file) {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (!file || !allowed.includes(file.type)) {
      alert('Please upload a PDF or Word document');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File must be less than 5MB');
      return;
    }

    this.currentFile = file;
    this.analyzeBtn.disabled = false;
    this.dropZone.querySelector('.drop-zone-text').textContent = file.name;
    this.dropZone.querySelector('.drop-zone-secondary').textContent =
      `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }

  async runAnalysis() {
    if (!this.currentFile) return;

    this.toggleBtn(true, 'Analyzing...');

    try {
      // Extract plain text
      const text = await this.extractText(this.currentFile);
      console.log('PARSED TEXT:', text);

      // Send JSON to server
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, documentType: 'cv_file' })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      console.log('FULL RESPONSE:', data);
      this.showFeedback(data.feedback || data);
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      this.toggleBtn(false, 'Analyze CV');
    }
  }

  toggleBtn(disabled, label) {
    this.analyzeBtn.disabled = disabled;
    this.analyzeBtn.textContent = label;
    this.analyzeBtn.classList.toggle('analyzing', disabled);
  }

  showFeedback(feedback) {
    this.reviewSection.classList.remove('hidden');
    let html = '';
    if (typeof feedback === 'string') {
      html = feedback
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    } else {
      const { strengths = [], areas_for_improvement = [], suggestions = [] } = feedback;
      html += '<section><h3>Strengths</h3><ul>';
      strengths.forEach(item => html += `<li>${item}</li>`);
      html += '</ul></section>';
      html += '<section><h3>Areas for Improvement</h3><ul>';
      areas_for_improvement.forEach(item => html += `<li>${item}</li>`);
      html += '</ul></section>';
      html += '<section><h3>Suggestions</h3><ul>';
      suggestions.forEach(item => html += `<li>${item}</li>`);
      html += '</ul></section>';
    }
    this.reviewOutput.innerHTML = html;
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

  loadScript(src, globalVar) {
    return new Promise((resolve, reject) => {
      if (window[globalVar]) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new DocumentUpload());
