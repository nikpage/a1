class AppController {
    constructor() {
        this.currentStep = 'upload';
        this.setupGlobalListeners();
        console.log('[AppController] Initialized.');
    }

    setupGlobalListeners() {
        window.addEventListener('error', (event) => {
            console.error('[Global Error]', event.message);
            this.showGlobalError('An unexpected error occurred. Please refresh and try again.');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('[Unhandled Promise]', event.reason);
            this.showGlobalError('Something went wrong. Please refresh and try again.');
        });
    }

    changeStep(newStep) {
        this.currentStep = newStep;
        this.updateView();
    }

    updateView() {
        const sections = {
            upload: document.getElementById('upload-section'),
            review: document.getElementById('review-section'),
            checkout: document.getElementById('checkout-section'),
            admin: document.getElementById('admin-section')
        };

        Object.keys(sections).forEach(section => {
            if (sections[section]) sections[section].classList.add('hidden');
        });

        if (sections[this.currentStep]) sections[this.currentStep].classList.remove('hidden');
    }

    showGlobalError(message) {
        alert(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
    new DocumentUpload();
});

class DocumentUpload {
    constructor() {
        this.dropZone = document.getElementById('drop-zone');
        this.fileInput = document.getElementById('file-input');
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.currentFile = null;
        this.setup();
    }

    setup() {
        this.dropZone.onclick = () => this.fileInput.click();
        this.dropZone.ondragover = (e) => { e.preventDefault(); };
        this.dropZone.ondrop = (e) => {
            e.preventDefault();
            this.selectFile(e.dataTransfer.files[0]);
        };
        this.fileInput.onchange = () => this.selectFile(this.fileInput.files[0]);
        this.analyzeBtn.onclick = () => this.runAnalysis();
    }

    selectFile(file) {
        if (!file) return alert('No file selected.');
        this.currentFile = file;
        this.analyzeBtn.disabled = false;
    }

    async runAnalysis() {
        if (!this.currentFile) return;

        const text = await this.currentFile.text();

        const res = await fetch('/api/save-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, documentType: 'cv_file' })
        });

        const data = await res.json();
        if (data.error) return alert('Error: ' + data.error);

        alert('Saved to MongoDB. ID: ' + data.insertedId);
    }
}
