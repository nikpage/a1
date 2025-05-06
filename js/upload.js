let parsedText = '';

class DocumentUpload {
  constructor() {
    this.dropZone = document.getElementById('drop-zone');
    this.fileInput = document.getElementById('file-input');
    this.analyzeBtn = document.getElementById('analyze-btn');
    this.reviewSection = document.getElementById('review-section');
    this.reviewOutput = document.getElementById('review-output');
    this.currentFile = null;
    this.setup();
    this.setupMetadataSubmit(); // add this line to set up event once
  }

  setup() {
    this.dropZone.addEventListener('click', () => {
      this.fileInput.value = null;
      this.fileInput.click();
    });

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
      if (e.dataTransfer.files.length > 0) {
        this.selectFile(e.dataTransfer.files[0]);
      }
    });
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files.length > 0) {
        this.selectFile(this.fileInput.files[0]);
      }
    });
    this.analyzeBtn.addEventListener('click', () => this.runAnalysis());
  }

  setupMetadataSubmit() {
    this.reviewOutput.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'submit-metadata-btn') {
        await this.handleMetadataSubmit();
      }
    });
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
      const text = await this.extractText(this.currentFile);
      parsedText = text;
      console.log('PARSED TEXT:', text);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, documentType: 'cv_file' })
      });

      const data = await res.json();
      this.showFeedback(data.feedback || data);
    } catch (err) {
      console.error(err);
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

    if (!feedback || typeof feedback !== 'object') {
      this.reviewOutput.innerHTML = '<p>No feedback data available.</p>';
      return;
    }

    let html = `
      <div id="feedback-result" style="margin-bottom: 30px;"></div>
      <form id="metadata-form">
    `;

    for (const key in feedback) {
      if (Array.isArray(feedback[key])) {
        html += `
          <div class="field-block">
            <label>${key}:</label><br>
            <textarea name="${key}" rows="2">${feedback[key].join(', ')}"></textarea>
            <label><input type="checkbox" name="use_${key}" checked> Use</label>
          </div><br>`;
      } else {
        html += `
          <div class="field-block">
            <label>${key}:</label><br>
            <input type="text" name="${key}" value="${feedback[key]}">
            <label><input type="checkbox" name="use_${key}" checked> Use</label>
          </div><br>`;
      }
    }

    html += `
      </form>
      <button id="submit-metadata-btn" style="margin-top: 20px; padding: 10px 20px;">Submit Metadata for AI Feedback</button>
    `;

    this.reviewOutput.innerHTML = html;
  }

  async handleMetadataSubmit() {
    const form = new FormData(document.getElementById('metadata-form'));
    const cleanedMetadata = {};

    for (const [key, value] of form.entries()) {
      if (key.startsWith('use_')) continue;
      const useKey = 'use_' + key;
      if (form.get(useKey)) {
        cleanedMetadata[key] = value.trim();
      }
    }

    try {
      const res = await fetch('/api/second-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: cleanedMetadata,
          cv_body: parsedText
        })
      });

      if (!res.ok) {
        console.error('Server error:', res.status);
        alert('Server error.');
        return;
      }

      const result = await res.json();

      document.getElementById('feedback-result').innerHTML = `
        <h3>AI Feedback:</h3>
        <div style="background:#f8f8f8; padding:1rem; border-radius:8px;">
          ${result.finalFeedback || result.feedback || 'No feedback available.'}
        </div>
      `;
    } catch (err) {
      console.error('Request error:', err);
      alert('Request error.');
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
