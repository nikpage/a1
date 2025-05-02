class DocumentUpload {
    constructor() {
        this.dropZone = document.getElementById('drop-zone');
        this.fileInput = document.getElementById('file-input');
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.reviewSection = document.getElementById('review-section');
        this.reviewOutput = document.getElementById('review-output');
        this.currentFile = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.dropZone.addEventListener('click', () => this.fileInput.click());

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        ['dragleave', 'dragend'].forEach(type => {
            this.dropZone.addEventListener(type, () => {
                this.dropZone.classList.remove('drag-over');
            });
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) this.handleFileSelection(e.dataTransfer.files[0]);
        });

        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files.length) this.handleFileSelection(this.fileInput.files[0]);
        });

        this.analyzeBtn.addEventListener('click', () => this.analyzeDocument());
    }

    handleFileSelection(file) {
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];

        if (!validTypes.includes(file.type)) {
            alert('Please upload a PDF or Word document');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        this.analyzeBtn.disabled = false;
        this.currentFile = file;
        this.dropZone.querySelector('.drop-zone-text').textContent = file.name;
        this.dropZone.querySelector('.drop-zone-secondary').textContent =
            `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }

    async analyzeDocument() {
        if (!this.currentFile) return;

        this.analyzeBtn.disabled = true;
        this.analyzeBtn.classList.add('analyzing');
        this.analyzeBtn.textContent = 'Analyzing...';

        try {
            const text = await this.extractText(this.currentFile);
            const feedbackData = await this.getFeedback(text);
            if (!feedbackData || !feedbackData.feedback) {
                throw new Error('Invalid feedback received.');
            }
            this.displayFeedback(feedbackData.feedback);
        } catch (error) {
            console.error('Analysis failed:', error);
            alert(`Sorry, something went wrong:\n\n${error.message || 'Unknown error.'}`);
        } finally {
            this.analyzeBtn.disabled = false;
            this.analyzeBtn.classList.remove('analyzing');
            this.analyzeBtn.textContent = 'Analyze CV';
        }
    }

    async extractText(file) {
        if (file.type === 'application/pdf') {
            return this.extractTextFromPDF(file);
        } else if (file.type.includes('word') || file.type.includes('document')) {
            return this.extractTextFromWord(file);
        } else {
            throw new Error('Unsupported file type.');
        }
    }

    async extractTextFromPDF(file) {
        if (!window.pdfjsLib) {
            await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js', 'pdfjsLib');
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }

        return text.trim();
    }

    async extractTextFromWord(file) {
        if (!window.mammoth) {
            await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.0/mammoth.browser.min.js', 'mammoth');
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value.trim();
    }

    async getFeedback(text) {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                documentType: 'cv_file'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'API request failed');
        }

        return await response.json();
    }

    displayFeedback(content) {
        this.reviewOutput.innerHTML = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        this.reviewSection.classList.remove('hidden');
    }

    loadScript(url, globalVar) {
        return new Promise((resolve, reject) => {
            if (window[globalVar]) return resolve();

            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(script);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => new DocumentUpload());
