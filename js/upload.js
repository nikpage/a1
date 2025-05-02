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
    this.dropZone.addEventListener('dragover', e => { e.preventDefault(); this.dropZone.classList.add('drag-over'); });
    ['dragleave','dragend'].forEach(ev => this.dropZone.addEventListener(ev, () => this.dropZone.classList.remove('drag-over')));
    this.dropZone.addEventListener('drop', e => { e.preventDefault(); this.dropZone.classList.remove('drag-over'); this.selectFile(e.dataTransfer.files[0]); });
    this.fileInput.addEventListener('change', () => this.selectFile(this.fileInput.files[0]));
    this.analyzeBtn.addEventListener('click', () => this.analyzeDocument());
  }

  selectFile(file) {
    const types = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'];
    if (!file || !types.includes(file.type)) return alert('Upload PDF or Word');
    if (file.size > 5*1024*1024) return alert('File >5MB');
    this.currentFile = file;
    this.analyzeBtn.disabled = false;
    this.dropZone.querySelector('.drop-zone-text').textContent = file.name;
    this.dropZone.querySelector('.drop-zone-secondary').textContent = `${(file.size/1024/1024).toFixed(2)} MB`;
  }

  async analyzeDocument() {
    if (!this.currentFile) return;
    this.toggleAnalyzing(true);
    try {
      const text = await this.extractText(this.currentFile);
      console.log('PARSED TEXT:', text);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ text, documentType: 'cv_file' })
      });
      if (!res.ok) throw new Error(`Analyze failed: ${res.status}`);
      const { feedback } = await res.json();
      this.showFeedback(feedback);
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      this.toggleAnalyzing(false);
    }
  }

  toggleAnalyzing(on) {
    this.analyzeBtn.disabled = on;
    this.analyzeBtn.textContent = on ? 'Analyzing...' : 'Analyze CV';
    this.analyzeBtn.classList.toggle('analyzing', on);
  }

  async extractText(file) {
    if (file.type === 'application/pdf') {
      if (!window.pdfjsLib) {
        await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js','pdfjsLib');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      }
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      let txt = '';
      for (let i=1; i<=pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        txt += content.items.map(item => item.str).join(' ') + '\n';
      }
      return txt.trim();
    } else {
      if (!window.mammoth) await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.0/mammoth.browser.min.js','mammoth');
      const buf = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
      return result.value.trim();
    }
  }

  showFeedback(html) {
    this.reviewOutput.innerHTML = html.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    this.reviewSection.classList.remove('hidden');
  }

  loadScript(src, varName) {
    return new Promise((res, rej) => {
      if (window[varName]) return res();
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(`Failed load ${src}`)); document.head.appendChild(s);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new DocumentUpload());
