// upload.js
class DocumentUpload {
    constructor(keyManager) {
        this.keyManager = keyManager;
        this.uploadInput = document.getElementById('document-upload');
        this.reviewSection = document.getElementById('review-section');
        this.reviewOutput = document.getElementById('review-output');

        this.uploadInput.addEventListener('change', this.handleUpload.bind(this));

        // Load required libraries dynamically
        this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js', 'pdfjs');
        this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.0/mammoth.browser.min.js', 'mammoth');
    }

    async handleUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            console.log(`Processing file: ${file.name}`);
            const text = await this.extractText(file);
            console.log('Document extracted:', text.substring(0, 100) + '...');

            const { feedback, usage } = await this.getFeedback(text);
            this.displayReview(feedback);

            console.log(`API usage: ${usage.total_tokens} tokens`);
            if (usage.total_cost) {
                console.log(`Estimated cost: $${usage.total_cost}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showError('Error processing document. Please try again.');
        }
    }

    async extractText(file) {
        if (file.type === 'application/pdf') {
            return this.extractTextFromPDF(file);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return this.extractTextFromDOCX(file);
        } else {
            throw new Error('Unsupported file type');
        }
    }

    async extractTextFromPDF(file) {
        const pdfjs = window.pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
        let text = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }

        return text;
    }

    async extractTextFromDOCX(file) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }

    async getFeedback(text) {
        const prompt = buildCVFeedbackPrompt('cv_file');
        const apiKey = this.keyManager.getCurrentKey();

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
        this.keyManager.rotateKey();
        this.keyManager.trackUsage(data.usage);

        return {
            feedback: data.choices[0]?.message?.content || 'No feedback generated',
            usage: data.usage
        };
    }

    displayReview(content) {
        this.reviewOutput.innerHTML = content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        this.reviewSection.classList.remove('hidden');
    }

    showError(message) {
        this.reviewOutput.innerHTML = `<div class="error">${message}</div>`;
        this.reviewSection.classList.remove('hidden');
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
