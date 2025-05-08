class DocumentUpload {
  constructor() {
    this.dropZone = document.getElementById('drop-zone');
    this.fileInput = document.getElementById('file-input');
    this.analyzeBtn = document.getElementById('analyze-btn');
    this.reviewSection = document.getElementById('review-section');
    this.reviewOutput = document.getElementById('review-output');
    this.currentFile = null;
    this.parsedText = '';
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
      const text = await this.extractText(this.currentFile);
      this.parsedText = text;
      console.log('PARSED TEXT:', text);

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
    if (!feedback || typeof feedback !== 'object') {
      this.reviewOutput.innerHTML = '<p>No feedback data available.</p>';
      return;
    }

    let html = `
      <form id="metadata-form" class="metadata-grid">

        <h2 class="section-title">General Info</h2>
        ${this.renderField('years_experience', feedback.years_experience)}
        ${this.renderField('education', feedback.education)}
        ${this.renderField('languages', feedback.languages)}
        ${this.renderField('key_achievements', feedback.key_achievements)}
        ${this.renderField('certifications', feedback.certifications)}

        <h2 class="section-title">Career Arcs</h2>
        ${this.renderLongField('career_arcs_summary', feedback.career_arcs_summary)}
        ${this.renderLongField('parallel_experiences_summary', feedback.parallel_experiences_summary)}

        <h2 class="section-title">Skills and Industries</h2>
        ${this.renderField('skills', feedback.skills)}
        ${this.renderField('industries', feedback.industries)}

        <div class="form-actions">
          <button id="submit-metadata-btn" type="button">Submit Cleaned Metadata</button>
        </div>
      </form>
    `;

    this.reviewOutput.innerHTML = html;

    document.getElementById('submit-metadata-btn').addEventListener('click', async () => {
      const form = new FormData(document.getElementById('metadata-form'));
      const payload = {};

      for (const [key, value] of form.entries()) {
        if (key.startsWith('use_')) continue;
        if (form.get('use_' + key)) {
          payload[key] = value.trim();
        }
      }

      try {
        const res = await fetch('/api/second-stage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: payload, cv_body: this.parsedText })
        });

        const result = await res.json();
        if (result.error) throw new Error(result.error);

        document.getElementById('feedback-result').innerHTML = `
          <h3>AI Feedback:</h3>
          <div class="feedback-box">${this.formatAIText(result.finalFeedback)}</div>
        `;
      } catch (err) {
        console.error('Error submitting metadata:', err);
        document.getElementById('feedback-result').innerHTML = `
          <h3>Error:</h3>
          <div class="feedback-box error">${err.message}</div>
        `;
      }
    });
  }

  renderField(key, value) {
    if (!value) return '';
    const pretty = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const field = Array.isArray(value) ? value.join(', ') : value;
    return `
      <div class="form-group">
        <label for="${key}">${pretty}</label>
        <input id="${key}" name="${key}" type="text" value="${field}">
        <div class="checkbox-group">
          <input type="checkbox" id="use_${key}" name="use_${key}" checked>
          <label for="use_${key}">Use</label>
        </div>
      </div>
    `;
  }

  renderLongField(key, value) {
    if (!value) return '';
    const pretty = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `
      <div class="form-group full-width">
        <label for="${key}">${pretty}</label>
        <textarea id="${key}" name="${key}" rows="15">${value}</textarea>
        <div class="checkbox-group">
          <input type="checkbox" id="use_${key}" name="use_${key}" checked>
          <label for="use_${key}">Use</label>
        </div>
      </div>
    `;
  }

  formatAIText(text) {
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
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
