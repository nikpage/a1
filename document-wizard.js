// Wizard state
let currentStep = 1;
let uploadedFile = null;
let documentContent = '';
let jobDescription = '';
let documentType = 'cv';
let documentTone = 'formal';
let documentLanguage = 'english';
let generatedDocument = null;
let generatedCoverLetter = null;

// Initialize wizard
function setupWizardEvents() {
    setupUploadStep();
    setupOptionsStep();
    setupPaymentStep();
    setupResultsStep();
}

// Upload step
function setupUploadStep() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const nextBtn = document.getElementById('next-btn-upload');

    if (!uploadArea || !fileInput || !nextBtn) return;

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    nextBtn.addEventListener('click', () => {
        jobDescription = document.getElementById('job-description').value;
        updateWizardProgress(2);
    });
}

// Options step
function setupOptionsStep() {
    const backBtn = document.getElementById('back-btn-options');
    const nextBtn = document.getElementById('next-btn-options');

    if (!backBtn || !nextBtn) return;

    backBtn.addEventListener('click', () => updateWizardProgress(1));

    nextBtn.addEventListener('click', () => {
        documentType = document.querySelector('input[name="doc-type"]:checked').value;
        documentTone = document.querySelector('input[name="tone"]:checked').value;
        documentLanguage = document.getElementById('language-select').value;

        updateSummary();
        generatePreview().then(() => updateWizardProgress(3));
    });
}

// Payment step
function setupPaymentStep() {
    const backBtn = document.getElementById('back-btn-payment');
    const proceedBtn = document.getElementById('proceed-payment-btn');

    if (!backBtn || !proceedBtn) return;

    backBtn.addEventListener('click', () => updateWizardProgress(2));
    proceedBtn.addEventListener('click', showPaymentModal);
}

// Results step
function setupResultsStep() {
    const downloadBtn = document.getElementById('download-doc-btn');
    const createAccountBtn = document.getElementById('create-account-btn');
    const newDocBtn = document.getElementById('new-document-btn');

    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadDocument);
    }

    if (createAccountBtn) {
        createAccountBtn.addEventListener('click', () => {
            if (isLoggedIn) {
                alert('You are already logged in');
            } else {
                showLoginModal();
            }
        });
    }

    if (newDocBtn) {
        newDocBtn.addEventListener('click', () => {
            resetWizard();
            updateWizardProgress(1);
        });
    }

    displayDocument();
    if (documentType === 'both') {
        setupDocumentToggle();
    }
}

// Update wizard progress
function updateWizardProgress(step) {
    currentStep = step;
    document.querySelectorAll('.wizard-step').forEach(el => {
        el.style.display = 'none';
    });
    document.getElementById(`step-${getStepId(step)}`).style.display = 'block';

    document.querySelectorAll('.progress-step').forEach(el => {
        const stepNum = parseInt(el.dataset.step);
        el.classList.remove('active', 'completed');
        if (stepNum === currentStep) {
            el.classList.add('active');
        } else if (stepNum < currentStep) {
            el.classList.add('completed');
        }
    });
}

// Generate document preview
async function generatePreview() {
    showLoading('Generating preview...');

    try {
        const payload = {
            document: documentContent,
            jobDescription,
            documentType,
            tone: documentTone,
            language: documentLanguage
        };

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (documentType === 'cv' || documentType === 'both') {
            generatedDocument = {
                content: result.cvContent,
                type: 'cv',
                date: new Date().toISOString()
            };
        }

        if (documentType === 'cover' || documentType === 'both') {
            generatedCoverLetter = {
                content: result.coverContent,
                type: 'cover',
                date: new Date().toISOString()
            };
        }

    } catch (error) {
        console.error('Preview generation error:', error);
        alert('Error generating preview');
    } finally {
        hideLoading();
    }
}

// Helper functions
function getStepId(step) {
    const steps = ['upload', 'options', 'payment', 'results'];
    return steps[step - 1] || 'upload';
}

function resetWizard() {
    uploadedFile = null;
    documentContent = '';
    jobDescription = '';
    documentType = 'cv';
    documentTone = 'formal';
    documentLanguage = 'english';
    generatedDocument = null;
    generatedCoverLetter = null;

    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.innerHTML = `
            <p>Drag & drop your CV/resume or click to browse</p>
            <input type="file" id="file-input" accept=".pdf,.doc,.docx" hidden>
        `;
    }

    const jobDescTextarea = document.getElementById('job-description');
    if (jobDescTextarea) jobDescTextarea.value = '';
}

function updateSummary() {
    const summaryType = document.getElementById('summary-type');
    const summaryTone = document.getElementById('summary-tone');
    const summaryLang = document.getElementById('summary-language');
    const summaryTokens = document.getElementById('summary-tokens');
    const summaryPrice = document.getElementById('summary-price');

    if (summaryType) summaryType.textContent = getReadableDocType(documentType);
    if (summaryTone) summaryTone.textContent = capitalizeFirstLetter(documentTone);
    if (summaryLang) summaryLang.textContent = capitalizeFirstLetter(documentLanguage);

    const tokenCount = calculateTokenEstimate();
    if (summaryTokens) summaryTokens.textContent = tokenCount.toLocaleString();

    const price = (tokenCount * 0.0001).toFixed(2);
    if (summaryPrice) summaryPrice.textContent = `$${price}`;
}

// Replace calculateTokenEstimate() with this real implementation:

async function getActualTokenUsage(payload) {
    try {
        // First get token count for the input
        const inputTokens = await countTokens(payload.document + payload.jobDescription);

        // Generate the document to count output tokens
        const generatedContent = await generateContent(payload);
        const outputTokens = await countTokens(generatedContent);

        return {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens
        };
    } catch (error) {
        console.error('Token counting failed:', error);
        throw error;
    }
}

async function countTokens(text) {
    const response = await fetch('https://api.deepseek.com/v1/tokenize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({ text })
    });

    const data = await response.json();
    return data.tokens.length;
}

async function generateContent(payload) {
    const response = await fetch('https://api.deepseek.com/v1/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{
                role: "user",
                content: buildPrompt(payload)
            }],
            max_tokens: 2000
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

// Update your payment summary to use real token counts
async function updateSummary() {
    try {
        const payload = {
            document: documentContent,
            jobDescription,
            documentType,
            tone: documentTone,
            language: documentLanguage
        };

        const { totalTokens } = await getActualTokenUsage(payload);

        document.getElementById('summary-tokens').textContent = totalTokens.toLocaleString();
        document.getElementById('summary-price').textContent =
            `$${(totalTokens * PRICE_PER_TOKEN).toFixed(2)}`;

    } catch (error) {
        console.error('Failed to calculate tokens:', error);
        document.getElementById('summary-tokens').textContent = 'Error';
        document.getElementById('summary-price').textContent = 'Error';
    }
}

// Add to your constants:
const PRICE_PER_TOKEN = 0.0001; // $0.0001 per token
const DEEPSEEK_API_KEY = DEEPSEEK_API_KEY; // Set this from environment variables

function getReadableDocType(type) {
    const types = {
        cv: 'CV/Resume',
        cover: 'Cover Letter',
        both: 'CV & Cover Letter'
    };
    return types[type] || 'Document';
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
