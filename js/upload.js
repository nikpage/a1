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
    this.dropZone.addEventListener('click', () => {
      this.fileInput.value = '';
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
      document.getElementById('upload-section').classList.add('hidden');

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

    const safe = (v) => (v !== undefined && v !== null ? v : '');

    let html = `
      <form id="metadata-form" class="metadata-grid">

        <h2 class="section-title">Career Development</h2>
        ${this.renderLongField('career_arcs_summary', safe(feedback.career_arcs_summary))}
        ${this.renderLongField('parallel_experiences_summary', safe(feedback.parallel_experiences_summary))}

        <h2 class="section-title">General Info</h2>
        ${this.renderField('education', safe(feedback.education))}
        ${this.renderField('languages', safe(feedback.languages))}
        ${this.renderField('years_experience', safe(feedback.years_experience))}

        <h2 class="section-title">Lists</h2>
        ${this.renderLongListField('certifications', safe(feedback.certifications))}
        ${this.renderLongListField('key_achievements', safe(feedback.key_achievements))}
        ${this.renderLongListField('industries', safe(feedback.industries))}
        ${this.renderLongListField('skills', safe(feedback.skills))}

      </form>
    `;

    this.reviewOutput.innerHTML = html;

    // Enhance form after injection
    this.initFormEnhancements();

    const oldBtn = document.getElementById('submit-metadata-btn');
    if (oldBtn) oldBtn.remove();

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit for AI Review';
    submitButton.style.marginTop = '20px';
    submitButton.style.padding = '10px 20px';
    submitButton.onclick = async () => {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';

      const metadataForm = document.getElementById('metadata-form');
      const fields = [...metadataForm.querySelectorAll('input[type="text"], textarea')];
      const metadata = {};

      fields.forEach(field => {
        const checkbox = document.getElementById(`use_${field.id}`);
        if (checkbox && checkbox.checked) {
          metadata[field.id] = field.value;
        }
      });

      try {
        const res = await fetch('/api/second-stage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata,
            cv_body: this.parsedText
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const reviewHTML = `
          <h2>Final AI Review</h2>
          <div class="review-text">${this.formatAIText(data.finalFeedback)}</div>
        `;

        setTimeout(() => {
          this.reviewOutput.innerHTML = reviewHTML;
        }, 100);

      } catch (err) {
        console.error('Submit metadata error:', err);
        alert('Error submitting metadata: ' + err.message);
      }
    };

    this.reviewOutput.appendChild(submitButton);
  }

  renderField(key, value) {
    const pretty = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `
      <div class="form-group">
        <label for="${key}">${pretty}</label>
        <input id="${key}" name="${key}" type="text" value="${value}" class="${key === 'education' ? 'full-width' : ''}">
        <div class="checkbox-group">
          <input type="checkbox" id="use_${key}" name="use_${key}" checked>
          <label for="use_${key}">Use</label>
        </div>
      </div>
    `;
  }

  renderLongField(key, value) {
    const pretty = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `
      <div class="form-group full-width">
        <label for="${key}">${pretty}</label>
        <textarea ... style="min-height: 40px; max-height: 500px; overflow-y: hidden;">...</textarea>
        <div class="checkbox-group">
          <input type="checkbox" id="use_${key}" name="use_${key}" checked>
          <label for="use_${key}">Use</label>
        </div>
      </div>
    `;
  }

  renderLongListField(key, value) {
    const pretty = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return `
      <div class="form-group full-width">
        <label for="${key}">${pretty}</label>
        <textarea id="${key}" name="${key}" rows="10">${value}</textarea>
        <div class="checkbox-group">
          <input type="checkbox" id="use_${key}" name="use_${key}" checked>
          <label for="use_${key}">Use</label>
        </div>
      </div>
    `;
  }

  formatAIText(text) {
    return text
      .replace(/---/g, '')
      .replace(/### (.+)/g, '<h2>$1</h2>')
      .replace(/#### (.+)/g, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
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

  // 🚀 Enhancement logic lives here
  initFormEnhancements() {
    document.querySelectorAll('textarea').forEach(el => {
      el.style.overflowY = 'hidden';
      const resize = () => {
        el.style.height = '0px';
        el.style.height = el.scrollHeight + 'px';

      };
      el.addEventListener('input', resize);
      resize();

      if (!el.value.trim()) {
        el.value = 'No content';
        el.classList.add('no-content-placeholder');
      }

      el.addEventListener('focus', () => {
        if (el.classList.contains('no-content-placeholder')) {
          el.value = '';
          el.classList.remove('no-content-placeholder');
        }
      });

      el.addEventListener('blur', () => {
        if (!el.value.trim()) {
          el.value = 'No content';
          el.classList.add('no-content-placeholder');
        }
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new DocumentUpload());
