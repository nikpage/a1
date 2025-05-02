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
        // Click handler
        this.dropZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Drag and drop handlers
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

            if (e.dataTransfer.files.length) {
                this.handleFileSelection(e.dataTransfer.files[0]);
            }
        });

        // File input change handler
        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files.length) {
                this.handleFileSelection(this.fileInput.files[0]);
            }
        });

        // Analyze button handler
        this.analyzeBtn.addEventListener('click', this.analyzeDocument.bind(this));
    }

    handleFileSelection(file) {
        // Validate file type
        const validTypes = ['application/pdf',
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'application/msword'];

        if (!validTypes.includes(file.type)) {
            alert('Please upload a PDF or Word document');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        // Enable analyze button
        this.analyzeBtn.disabled = false;
        this.currentFile = file;

        // Update UI
        this.dropZone.querySelector('.drop-zone-text').textContent = file.name;
        this.dropZone.querySelector('.drop-zone-secondary').textContent =
            `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    }

    async analyzeDocument() {
        if (!this.currentFile) return;

        this.analyzeBtn.disabled = true;
        this.analyzeBtn.textContent = 'Analyzing...';

        try {
            const text = await this.extractText(this.currentFile);
            const feedback = await this.getFeedback(text);
            this.displayFeedback(feedback);
        } catch (error) {
            console.error('Analysis failed:', error);
            alert('Analysis failed. Please try again.');
        } finally {
            this.analyzeBtn.disabled = false;
            this.analyzeBtn.textContent = 'Analyze CV';
        }
    }

    async extractText(file) {
        if (file.type === 'application/pdf') {
            return this.extractTextFromPDF(file);
        } else {
            return this.extractTextFromWord(file);
        }
    }

    async extractTextFromPDF(file) {
        // Load PDF.js dynamically if not already loaded
        if (!window.pdfjsLib) {
            await this.loadScript(
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
                'pdfjsLib'
            );
            pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let text = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }

        return text;
    }

    async extractTextFromWord(file) {
        // Load mammoth.js dynamically if not already loaded
        if (!window.mammoth) {
            await this.loadScript(
                'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.0/mammoth.browser.min.js',
                'mammoth'
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }

    async getFeedback(text) {
        const prompt = buildCVFeedbackPrompt('cv_file');
        const apiKey = process.env.DEEPSEEK_API_KEY; // Using Vercel environment variable

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: text }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return {
            feedback: data.choices[0]?.message?.content || 'No feedback generated',
            usage: data.usage
        };
    }

    displayFeedback(content) {
        this.reviewOutput.innerHTML = this.formatFeedback(content);
        this.reviewSection.classList.remove('hidden');
        this.reviewSection.scrollIntoView({ behavior: 'smooth' });
    }

    formatFeedback(text) {
        // Convert markdown-like formatting to HTML
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/- (.*?)(?=\n|$)/g, '<li>$1</li>')
            .replace(/\n/g, '<br>');
    }

    loadScript(url, globalVar) {
        return new Promise((resolve, reject) => {
            if (window[globalVar]) return resolve();

            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve();
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DocumentUpload();
});
