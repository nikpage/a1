// ===== Z4 VERSION =====
// js/uploads.js
let parsedText = '';

class DocumentUpload {
  constructor() {
    this.dropZone = document.getElementById('drop-zone');
    this.fileInput = document.getElementById('file-input');
    this.analyzeBtn = document.getElementById('analyze-btn');
    this.submitMetadataBtn = document.getElementById('submit-metadata-btn'); // ✅ added correctly
    this.reviewSection = document.getElementById('review-section');
    this.reviewOutput = document.getElementById('review-output');
    this.currentFile = null;
    this.setup();
    this.setupButtons(); // ✅ correct
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
  }

  setupButtons() {
    this.analyzeBtn.addEventListener('click', () => this.runAnalysis());
    this.submitMetadataBtn.addEventListener('click', () => this.handleMetadataSubmit());
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
            <textarea name="${key}" rows="2">${feedback[key].join(', ')}</textarea>
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
      <button id="submit-metadata-btn" type="button" style="margin-top: 20px; padding: 10px 20px;">Submit Metadata</button>
      </form>
    `;

    this.reviewOutput.innerHTML = html;

    // ✅ ADD THIS: Attach event listener **after** button is inserted
    document.getElementById('submit-metadata-btn').addEventListener('click', () => this.handleMetadataSubmit());
}
