// Main JavaScript for CV & Cover Letter Writer

// Global variables
let currentStep = 1;
let uploadedFile = null;
let documentContent = "";
let jobDescription = "";
let documentType = "cv";
let documentTone = "formal";
let documentLanguage = "english";
let isLoggedIn = false;
let isAdmin = false;
let currentUser = null;
let generatedDocument = null;
let stripeInstance = null;
let cardElement = null;

// Constants
const PRICE_PER_TOKEN = 0.0001; // $0.0001 per token
const TOKEN_ESTIMATE = {
    cv: 2000,
    cover: 1500,
    both: 3500
};

// Mock database functions (will be replaced with Supabase in production)
const db = {
    users: [],
    documents: [],
    transactions: [],

    getUsers: function() {
        const storedData = localStorage.getItem('app_users');
        return storedData ? JSON.parse(storedData) : [];
    },

    getDocuments: function() {
        const storedData = localStorage.getItem('app_documents');
        return storedData ? JSON.parse(storedData) : [];
    },

    getTransactions: function() {
        const storedData = localStorage.getItem('app_transactions');
        return storedData ? JSON.parse(storedData) : [];
    },

    saveUsers: function(data) {
        localStorage.setItem('app_users', JSON.stringify(data));
    },

    saveDocuments: function(data) {
        localStorage.setItem('app_documents', JSON.stringify(data));
    },

    saveTransactions: function(data) {
        localStorage.setItem('app_transactions', JSON.stringify(data));
    },

    addUser: function(user) {
        const users = this.getUsers();
        users.push(user);
        this.saveUsers(users);
    },

    addDocument: function(document) {
        const documents = this.getDocuments();
        documents.push(document);
        this.saveDocuments(documents);
    },

    addTransaction: function(transaction) {
        const transactions = this.getTransactions();
        transactions.push(transaction);
        this.saveTransactions(transactions);
    },

    getUserByEmail: function(email) {
        const users = this.getUsers();
        return users.find(user => user.email === email);
    },

    getUserById: function(id) {
        const users = this.getUsers();
        return users.find(user => user.id === id);
    },

    getDocumentsByUserId: function(userId) {
        const documents = this.getDocuments();
        return documents.filter(doc => doc.userId === userId);
    },

    getTokenBalance: function(userId) {
        const user = this.getUserById(userId);
        return user ? (user.tokenBalance || 0) : 0;
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize Stripe if available
        if (typeof Stripe !== 'undefined') {
            stripeInstance = Stripe('pk_test_placeholder'); // Replace with your Stripe public key in production
        }

        // Render landing page
        renderPage('landing');

        // Add event listeners
        setupEventListeners();

        // Check if user is logged in
        checkAuthStatus();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('An error occurred during initialization. Please refresh the page.');
    }
});

// Setup global event listeners
function setupEventListeners() {
    // Login button in nav
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', showLoginModal);
    }

    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(function(closeBtn) {
        closeBtn.addEventListener('click', function() {
            const modal = closeBtn.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        document.querySelectorAll('.modal').forEach(function(modal) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Setup auth form
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }

    // Auth switch (login/signup toggle)
    const authSwitch = document.getElementById('auth-switch');
    if (authSwitch) {
        authSwitch.addEventListener('click', toggleAuthMode);
    }
}

// Core functions to render different pages
function renderPage(page) {
    const mainContent = document.getElementById('main-content');
    const template = document.getElementById(`${page}-template`);

    if (!template) {
        console.error(`Template for ${page} not found`);
        return;
    }

    mainContent.innerHTML = '';
    const templateContent = template.content.cloneNode(true);
    mainContent.appendChild(templateContent);

    // Additional setup based on page
    switch (page) {
        case 'landing':
            const startBtn = document.getElementById('start-btn');
            if (startBtn) {
                startBtn.addEventListener('click', function() {
                    renderPage('wizard');
                    updateWizardProgress(1);
                });
            }
            break;
        case 'wizard':
            setupWizardEvents();
            break;
        case 'account':
            populateAccountData();
            break;
        case 'success':
            setupSuccessEvents();
            break;
    }
}

// Function to check auth status
function checkAuthStatus() {
    try {
        const storedUser = localStorage.getItem('currentUser');

        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            isLoggedIn = true;

            // Check if admin
            isAdmin = currentUser.role === 'admin';

            // Update UI based on login status
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.textContent = isAdmin ? 'Admin Dashboard' : 'My Account';

                // Remove old event listener (this is a simplified approach)
                loginBtn.outerHTML = loginBtn.outerHTML;

                // Add new event listener to the new button
                const newLoginBtn = document.getElementById('login-btn');
                if (newLoginBtn) {
                    newLoginBtn.addEventListener('click', function() {
                        if (isAdmin) {
                            showAdminDashboard();
                        } else {
                            renderPage('account');
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

// Login/Auth Modal functions
function showLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

let isLoginMode = true;

function toggleAuthMode(e) {
    e.preventDefault();
    isLoginMode = !isLoginMode;

    const authToggle = document.getElementById('auth-toggle');
    const authSwitch = document.getElementById('auth-switch');
    const authSubmit = document.getElementById('auth-submit');

    if (isLoginMode) {
        authToggle.textContent = "Don't have an account? ";
        authSwitch.textContent = "Sign Up";
        authSubmit.textContent = "Login";
    } else {
        authToggle.textContent = "Already have an account? ";
        authSwitch.textContent = "Login";
        authSubmit.textContent = "Sign Up";
    }
}

function handleAuth(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    try {
        showLoading('Authenticating...');

        setTimeout(function() {
            let user;

            if (isLoginMode) {
                // Login
                user = db.getUserByEmail(email);

                if (!user) {
                    if (email === 'admin@example.com') {
                        // Create admin user for testing
                        user = {
                            id: 'admin_1',
                            email: email,
                            role: 'admin',
                            tokenBalance: 10000
                        };
                        db.addUser(user);
                    } else {
                        // Create regular user for testing
                        user = {
                            id: 'user_' + Date.now(),
                            email: email,
                            role: 'user',
                            tokenBalance: 0
                        };
                        db.addUser(user);
                    }
                }
            } else {
                // Register
                user = db.getUserByEmail(email);

                if (!user) {
                    user = {
                        id: 'user_' + Date.now(),
                        email: email,
                        role: 'user',
                        tokenBalance: 0
                    };
                    db.addUser(user);
                }
            }

            currentUser = user;
            isLoggedIn = true;
            isAdmin = user.role === 'admin';

            // Store user in localStorage for session persistence
            localStorage.setItem('currentUser', JSON.stringify(user));

            // Close modal
            const loginModal = document.getElementById('login-modal');
            if (loginModal) {
                loginModal.style.display = 'none';
            }

            // Update UI based on login status
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.textContent = isAdmin ? 'Admin Dashboard' : 'My Account';

                // Remove old event listener (this is a simplified approach)
                loginBtn.outerHTML = loginBtn.outerHTML;

                // Add new event listener to the new button
                const newLoginBtn = document.getElementById('login-btn');
                if (newLoginBtn) {
                    newLoginBtn.addEventListener('click', function() {
                        if (isAdmin) {
                            showAdminDashboard();
                        } else {
                            renderPage('account');
                        }
                    });
                }
            }

            hideLoading();

            // If admin, show dashboard
            if (isAdmin) {
                showAdminDashboard();
            }
        }, 1000);

    } catch (error) {
        hideLoading();
        console.error('Auth error:', error);
        alert('Authentication failed: ' + (error.message || 'Unknown error'));
    }
}

// Wizard functionality
function setupWizardEvents() {
    // Upload step
    setupUploadStep();

    // Options step
    setupOptionsStep();

    // Payment step
    setupPaymentStep();

    // Results step
    setupResultsStep();
}

// Upload step functionality
function setupUploadStep() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const nextBtn = document.getElementById('next-btn-upload');

    if (!uploadArea || !fileInput || !nextBtn) return;

    // Setup file input
    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });

    // Handle drag and drop
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function() {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    // Handle file selection
    fileInput.addEventListener('change', function() {
        if (fileInput.files.length) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    // Next button
    nextBtn.addEventListener('click', function() {
        const jobDescTextarea = document.getElementById('job-description');
        if (jobDescTextarea) {
            jobDescription = jobDescTextarea.value;
        }
        updateWizardProgress(2);
    });
}

// Handle file upload
function handleFileUpload(file) {
    const acceptedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!acceptedTypes.includes(file.type)) {
        alert('Please upload a PDF or Word document');
        return;
    }

    uploadedFile = file;

    // Show loading
    showLoading('Parsing document...');

    // Read file
    const reader = new FileReader();
    reader.onload = function(e) {
        // In production, you would send this to your backend for parsing
        // For now, we'll simulate parsing
        setTimeout(function() {
            documentContent = `Parsed content from ${file.name}`;

            // Update UI
            const uploadAreaEl = document.getElementById('upload-area');
            if (uploadAreaEl) {
                uploadAreaEl.innerHTML = `
                    <p>File uploaded: ${file.name}</p>
                    <p>Size: ${Math.round(file.size / 1024)} KB</p>
                    <p>Click to change file</p>
                `;
            }

            // Enable next button
            const nextBtn = document.getElementById('next-btn-upload');
            if (nextBtn) {
                nextBtn.disabled = false;
            }

            hideLoading();
        }, 1500);
    };

    reader.onerror = function() {
        hideLoading();
        alert('Error reading file');
    };

    reader.readAsArrayBuffer(file);
}

// Options step functionality
function setupOptionsStep() {
    const backBtn = document.getElementById('back-btn-options');
    const nextBtn = document.getElementById('next-btn-options');

    if (!backBtn || !nextBtn) return;

    // Back button
    backBtn.addEventListener('click', function() {
        updateWizardProgress(1);
    });

    // Next button
    nextBtn.addEventListener('click', function() {
        // Get selected options
        const docTypeRadios = document.querySelectorAll('input[name="doc-type"]');
        docTypeRadios.forEach(function(radio) {
            if (radio.checked) {
                documentType = radio.value;
            }
        });

        const toneRadios = document.querySelectorAll('input[name="tone"]');
        toneRadios.forEach(function(radio) {
            if (radio.checked) {
                documentTone = radio.value;
            }
        });

        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            documentLanguage = langSelect.value;
        }

        // Update summary
        const summaryType = document.getElementById('summary-type');
        const summaryTone = document.getElementById('summary-tone');
        const summaryLang = document.getElementById('summary-language');
        const summaryTokens = document.getElementById('summary-tokens');
        const summaryPrice = document.getElementById('summary-price');

        if (summaryType) summaryType.textContent = getReadableDocType(documentType);
        if (summaryTone) summaryTone.textContent = capitalizeFirstLetter(documentTone);
        if (summaryLang) summaryLang.textContent = capitalizeFirstLetter(documentLanguage);

        const tokenCount = TOKEN_ESTIMATE[documentType];
        if (summaryTokens) summaryTokens.textContent = tokenCount.toLocaleString();

        const price = (tokenCount * PRICE_PER_TOKEN).toFixed(2);
        if (summaryPrice) summaryPrice.textContent = `$${price}`;

        updateWizardProgress(3);
    });
}

// Payment step functionality
function setupPaymentStep() {
    const backBtn = document.getElementById('back-btn-payment');
    const proceedBtn = document.getElementById('proceed-payment-btn');

    if (!backBtn || !proceedBtn) return;

    // Back button
    backBtn.addEventListener('click', function() {
        updateWizardProgress(2);
    });

    // Proceed to payment button
    proceedBtn.addEventListener('click', function() {
        showPaymentModal();
    });
}

// Results step functionality
function setupResultsStep() {
    const previewBtn = document.getElementById('preview-doc-btn');
    const downloadBtn = document.getElementById('download-doc-btn');
    const createAccountBtn = document.getElementById('create-account-btn');
    const newDocBtn = document.getElementById('new-document-btn');

    if (!previewBtn || !downloadBtn || !createAccountBtn || !newDocBtn) return;

    // Preview button
    previewBtn.addEventListener('click', function() {
        showDocumentPreview();
    });

    // Download button
    downloadBtn.addEventListener('click', function() {
        downloadDocument();
    });

    // Create account button
    createAccountBtn.addEventListener('click', function() {
        if (isLoggedIn) {
            alert('You are already logged in');
        } else {
            showLoginModal();
            toggleAuthMode({ preventDefault: function() {} }); // Switch to signup mode
        }
    });

    // New document button
    newDocBtn.addEventListener('click', function() {
        resetWizard();
        updateWizardProgress(1);
    });
}

// Wizard helper functions
function updateWizardProgress(step) {
    currentStep = step;

    // Update progress indicator
    const progressSteps = document.querySelectorAll('.progress-step');
    progressSteps.forEach(function(el) {
        const stepNum = parseInt(el.dataset.step);
        el.classList.remove('active', 'completed');

        if (stepNum === currentStep) {
            el.classList.add('active');
        } else if (stepNum < currentStep) {
            el.classList.add('completed');
        }
    });

    // Show appropriate step
    const wizardSteps = document.querySelectorAll('.wizard-step');
    wizardSteps.forEach(function(el) {
        el.style.display = 'none';
    });

    const stepId = getStepId(step);
    const stepEl = document.getElementById(stepId);
    if (stepEl) {
        stepEl.style.display = 'block';
    }
}

function getStepId(step) {
    switch (step) {
        case 1: return 'step-upload';
        case 2: return 'step-options';
        case 3: return 'step-payment';
        case 4: return 'step-results';
        default: return 'step-upload';
    }
}

function resetWizard() {
    // Reset variables
    uploadedFile = null;
    documentContent = "";
    jobDescription = "";
    documentType = "cv";
    documentTone = "formal";
    documentLanguage = "english";
    generatedDocument = null;

    // Reset UI
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.innerHTML = `
            <p>Drag & drop your CV/resume or click to browse</p>
            <input type="file" id="file-input" accept=".pdf,.doc,.docx" hidden>
        `;
    }

    const nextBtn = document.getElementById('next-btn-upload');
    if (nextBtn) {
        nextBtn.disabled = true;
    }

    const jobDescTextarea = document.getElementById('job-description');
    if (jobDescTextarea) {
        jobDescTextarea.value = '';
    }

    const cvRadio = document.querySelector('input[name="doc-type"][value="cv"]');
    if (cvRadio) {
        cvRadio.checked = true;
    }

    const formalRadio = document.querySelector('input[name="tone"][value="formal"]');
    if (formalRadio) {
        formalRadio.checked = true;
    }

    const langSelect = document.getElementById('language-select');
    if (langSelect) {
        langSelect.value = 'english';
    }
}

// Payment functionality
function showPaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (!modal) return;

    // Setup payment details
    const tokenCount = TOKEN_ESTIMATE[documentType];
    const price = (tokenCount * PRICE_PER_TOKEN).toFixed(2);

    const tokenCountEl = document.getElementById('token-count');
    const priceDisplayEl = document.getElementById('price-display');

    if (tokenCountEl) tokenCountEl.textContent = tokenCount.toLocaleString();
    if (priceDisplayEl) priceDisplayEl.textContent = `$${price}`;

    // Create card element if Stripe is available
    if (stripeInstance && !cardElement) {
        const elements = stripeInstance.elements();
        cardElement = elements.create('card');

        // Wait for DOM to be ready
        setTimeout(function() {
            const cardElementMount = document.getElementById('card-element');
            if (cardElementMount) {
                cardElement.mount('#card-element');

                // Handle validation errors
                cardElement.addEventListener('change', function(event) {
                    const displayError = document.getElementById('card-errors');
                    if (displayError) {
                        if (event.error) {
                            displayError.textContent = event.error.message;
                        } else {
                            displayError.textContent = '';
                        }
                    }
                });
            }
        }, 100);

        // Setup payment form
        const form = document.getElementById('payment-form');
        if (form) {
            form.addEventListener('submit', handlePaymentSubmission);
        }
    }

    modal.style.display = 'block';
}

function handlePaymentSubmission(e) {
    e.preventDefault();

    const tokenCount = TOKEN_ESTIMATE[documentType];
    const amount = tokenCount * PRICE_PER_TOKEN * 100; // Convert to cents

    try {
        showLoading('Processing payment...');

        // In production, this would make a call to your backend which creates a Payment Intent with Stripe
        // For now, we'll simulate a successful payment

        setTimeout(function() {
            // Simulate document generation
            generateDocument()
                .then(function() {
                    // Create transaction record
                    const transaction = {
                        id: 'txn_' + Date.now(),
                        userId: currentUser ? currentUser.id : 'guest',
                        amount: amount / 100,
                        date: new Date().toISOString(),
                        tokens: tokenCount,
                        documentType: documentType
                    };

                    // Store in database
                    db.addTransaction(transaction);

                    // Close modal
                    const paymentModal = document.getElementById('payment-modal');
                    if (paymentModal) {
                        paymentModal.style.display = 'none';
                    }

                    // Move to results step
                    updateWizardProgress(4);

                    hideLoading();
                })
                .catch(function(error) {
                    hideLoading();
                    console.error('Document generation error:', error);
                    alert('Error generating document: ' + (error.message || 'Unknown error'));
                });
        }, 2000);

    } catch (error) {
        hideLoading();
        console.error('Payment error:', error);

        const cardErrors = document.getElementById('card-errors');
        if (cardErrors) {
            cardErrors.textContent = error.message || 'Payment failed';
        }
    }
}

// Document generation and handling
function generateDocument() {
    showLoading('Generating your document...');

    // This returns a promise to simulate async document generation
    return new Promise(function(resolve, reject) {
        try {
            setTimeout(function() {
                // In production, this would use prompt-builder.js to generate real content
                // based on the uploaded document and selected options
                let content = '';

                if (documentType === 'cv' || documentType === 'both') {
                    content += `
                        <div class="cv-section">
                            <h2>Professional Summary</h2>
                            <p>Your professional summary will be generated here.</p>

                            <h2>Experience</h2>
                            <p>Your work experience will be formatted here.</p>

                            <h2>Skills</h2>
                            <p>Your skills will be organized here.</p>

                            <h2>Education</h2>
                            <p>Your education history will be formatted here.</p>
                        </div>
                    `;
                }

                if (documentType === 'cover' || documentType === 'both') {
                    content += `
                        <div class="cover-letter-section">
                            <h2>Cover Letter</h2>
                            <p>Your professional cover letter will be written here.</p>
                            <p>It will follow your selected tone (${documentTone}) and highlight key qualifications.</p>
                            <p>The letter will be tailored to the job description if provided.</p>
                        </div>
                    `;
                }

                generatedDocument = {
                    content: content,
                    type: documentType,
                    tone: documentTone,
                    language: documentLanguage,
                    date: new Date().toISOString(),
                    id: 'doc_' + Date.now()
                };

                // Update preview box
                const previewBox = document.getElementById('preview-box');
                if (previewBox) {
                    previewBox.innerHTML = '<p>Your document is ready! Click "Preview" to view it.</p>';
                }

                // Store document in database
                const docRecord = {
                    id: generatedDocument.id,
                    userId: currentUser ? currentUser.id : 'guest',
                    type: documentType,
                    date: new Date().toISOString()
                };

                db.addDocument(docRecord);

                hideLoading();
                resolve();
            }, 3000);
        } catch (error) {
            hideLoading();
            reject(error);
        }
    });
}

function showDocumentPreview() {
    if (!generatedDocument) {
        alert('No document to preview');
        return;
    }

    const previewModal = document.getElementById('preview-modal');
    const previewContent = document.getElementById('document-preview');

    if (!previewModal || !previewContent) return;

    // Set content
    previewContent.innerHTML = generatedDocument.content;

    // Show modal
    previewModal.style.display = 'block';
}

function downloadDocument() {
    if (!generatedDocument) {
        alert('No document to download');
        return;
    }

    // In production, you'd create a proper file
    // For now, we'll simulate a download using a data URL

    const fileName = `${getReadableDocType(documentType)}_${documentTone}_${new Date().getTime()}.html`;

    const htmlContent = `<!DOCTYPE html>
    <html>
    <head>
        <title>${fileName}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1, h2 { color: #2c3e50; }
        </style>
    </head>
    <body>
        ${generatedDocument.content}
    </body>
    </html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Success page functions
function setupSuccessEvents() {
    const viewDocsBtn = document.getElementById('view-docs-btn');
    const createAccountForm = document.getElementById('create-account-form');
    const loginLink = document.getElementById('login-link');

    if (viewDocsBtn) {
        viewDocsBtn.addEventListener('click', function() {
            renderPage('wizard');
            updateWizardProgress(4);
        });
    }

    if (createAccountForm) {
        createAccountForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const email = document.getElementById('new-email').value;
            const password = document.getElementById('new-password').value;

            if (!email || !password) {
                alert('Please enter both email and password');
                return;
            }

            try {
                showLoading('Creating account...');

                setTimeout(function() {
                    // Check if user already exists
                    let user = db.getUserByEmail(email);

                    if (!user) {
                        user = {
                            id: 'user_' + Date.now(),
                            email: email,
                            role: 'user',
                            tokenBalance: 0
                        };
                        db.addUser(user);
                    }

                    currentUser = user;
                    isLoggedIn = true;

                    // Store user in localStorage for session persistence
                    localStorage.setItem('currentUser', JSON.stringify(user));

                    // Update UI
                    const loginBtn = document.getElementById('login-btn');
                    if (loginBtn) {
                        loginBtn.textContent = 'My Account';

                        // Remove old event listener (this is a simplified approach)
                        loginBtn.outerHTML = loginBtn.outerHTML;

                        // Add new event listener to the new button
                        const newLoginBtn = document.getElementById('login-btn');
                        if (newLoginBtn) {
                            newLoginBtn.addEventListener('click', function() {
                                renderPage('account');
                            });
                        }
                    }

                    hideLoading();

                    // Redirect to account page
                    renderPage('account');
                }, 1000);

            } catch (error) {
                hideLoading();
                console.error('Account creation error:', error);
                alert('Account creation failed: ' + (error.message || 'Unknown error'));
            }
        });
    }

    if (loginLink) {
        loginLink.addEventListener('click', function(e) {
            e.preventDefault();
            showLoginModal();
        });
    }
}

// Account page functions
function populateAccountData() {
    if (!isLoggedIn || !currentUser) {
        // Redirect to landing if not logged in
        renderPage('landing');
        return;
    }

    // Set email
    const emailEl = document.getElementById('account-email');
    if (emailEl) {
        emailEl.textContent = currentUser.email;
    }

    // Get token balance from database
    const tokensEl = document.getElementById('account-tokens');
    if (tokensEl) {
        tokensEl.textContent = db.getTokenBalance(currentUser.id).toString();
    }

    // Buy tokens button
    const buyTokensBtn = document.getElementById('buy-tokens-btn');
    if (buyTokensBtn) {
        buyTokensBtn.addEventListener('click', showBuyTokensModal);
    }

    // Populate document history
    populateDocumentHistory();
}

// Function to handle buying tokens
function showBuyTokensModal() {
    // In a real app, you would implement a token purchase modal here
    // For now, we'll just show a message
    alert('Token purchase functionality will be implemented in the full version.');
}

async function populateDocumentHistory() {
    if (!currentUser) return;

    const tableBody = document.getElementById('history-body');
    if (!tableBody) return;

    try {
        // Get documents from database
        const documents = db.getDocumentsByUserId(currentUser.id);

        // Clear table
        tableBody.innerHTML = '';

        if (documents && documents.length > 0) {
            documents.forEach(function(doc) {
                const row = document.createElement('tr');

                const nameCell = document.createElement('td');
                nameCell.textContent = `Document ${doc.id.substring(doc.id.length - 5)}`;

                const typeCell = document.createElement('td');
                typeCell.textContent = getReadableDocType(doc.type);

                const dateCell = document.createElement('td');
                dateCell.textContent = new Date(doc.date).toLocaleDateString();

                const actionsCell = document.createElement('td');

                const viewBtn = document.createElement('button');
                viewBtn.textContent = 'View';
                viewBtn.className = 'btn-secondary';
                viewBtn.style.marginRight = '5px';
                viewBtn.addEventListener('click', function() {
                    // In production, this would retrieve and display the document
                    alert('View document functionality will be implemented in the full version.');
                });

                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = 'Download';
                downloadBtn.className = 'btn-primary';
                downloadBtn.addEventListener('click', function() {
                    // In production, this would download the document
                    alert('Download document functionality will be implemented in the full version.');
                });

                actionsCell.appendChild(viewBtn);
                actionsCell.appendChild(downloadBtn);

                row.appendChild(nameCell);
                row.appendChild(typeCell);
                row.appendChild(dateCell);
                row.appendChild(actionsCell);

                tableBody.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.textContent = 'No documents found';
            cell.style.textAlign = 'center';
            row.appendChild(cell);
            tableBody.appendChild(row);
        }
    } catch (error) {
        console.error('Error loading document history:', error);
        alert('Failed to load document history: ' + (error.message || 'Unknown error'));
    }
}

// Admin dashboard functions
function showAdminDashboard() {
    if (!isAdmin) {
        alert('You do not have admin access');
        return;
    }

    const modal = document.getElementById('admin-modal');
    if (!modal) return;

    // Populate admin data
    populateAdminData();

    // Show modal
    modal.style.display = 'block';
}

function populateAdminData() {
    try {
        // Get data from database
        const users = db.getUsers();
        const documents = db.getDocuments();
        const transactions = db.getTransactions();

        // Calculate totals
        const userCount = users.length;
        const docCount = documents.length;

        let totalRevenue = 0;
        if (transactions && transactions.length > 0) {
            totalRevenue = transactions.reduce(function(sum, txn) {
                return sum + (txn.amount || 0);
            }, 0);
        }

        // Update dashboard
        const userCountEl = document.getElementById('user-count');
        const docCountEl = document.getElementById('doc-count');
        const revenueEl = document.getElementById('revenue');

        if (userCountEl) userCountEl.textContent = userCount;
        if (docCountEl) docCountEl.textContent = docCount;
        if (revenueEl) revenueEl.textContent = `${totalRevenue.toFixed(2)}`;

        // Populate transactions table
        const transactionsBody = document.getElementById('transactions-body');
        if (transactionsBody) {
            transactionsBody.innerHTML = '';

            if (transactions && transactions.length > 0) {
                // Sort by date (newest first)
                transactions.sort(function(a, b) {
                    return new Date(b.date) - new Date(a.date);
                });

                // Take only the most recent 10
                const recentTransactions = transactions.slice(0, 10);

                recentTransactions.forEach(function(txn) {
                    const row = document.createElement('tr');

                    const idCell = document.createElement('td');
                    idCell.textContent = txn.id;

                    const userCell = document.createElement('td');
                    // Get user email from ID
                    const user = db.getUserById(txn.userId);
                    userCell.textContent = user ? user.email : 'Unknown';

                    const amountCell = document.createElement('td');
                    amountCell.textContent = `${txn.amount.toFixed(2)}`;

                    const dateCell = document.createElement('td');
                    dateCell.textContent = new Date(txn.date).toLocaleDateString();

                    row.appendChild(idCell);
                    row.appendChild(userCell);
                    row.appendChild(amountCell);
                    row.appendChild(dateCell);

                    transactionsBody.appendChild(row);
                });
            } else {
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 4;
                cell.textContent = 'No transactions found';
                cell.style.textAlign = 'center';
                row.appendChild(cell);
                transactionsBody.appendChild(row);
            }
        }

        // Populate documents table
        const documentsBody = document.getElementById('documents-body');
        if (documentsBody) {
            documentsBody.innerHTML = '';

            if (documents && documents.length > 0) {
                // Sort by date (newest first)
                documents.sort(function(a, b) {
                    return new Date(b.date) - new Date(a.date);
                });

                // Take only the most recent 10
                const recentDocuments = documents.slice(0, 10);

                recentDocuments.forEach(function(doc) {
                    const row = document.createElement('tr');

                    const idCell = document.createElement('td');
                    idCell.textContent = doc.id;

                    const userCell = document.createElement('td');
                    // Get user email from ID
                    const user = db.getUserById(doc.userId);
                    userCell.textContent = user ? user.email : 'Unknown';

                    const typeCell = document.createElement('td');
                    typeCell.textContent = getReadableDocType(doc.type);

                    const dateCell = document.createElement('td');
                    dateCell.textContent = new Date(doc.date).toLocaleDateString();

                    row.appendChild(idCell);
                    row.appendChild(userCell);
                    row.appendChild(typeCell);
                    row.appendChild(dateCell);

                    documentsBody.appendChild(row);
                });
            } else {
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 4;
                cell.textContent = 'No documents found';
                cell.style.textAlign = 'center';
                row.appendChild(cell);
                documentsBody.appendChild(row);
            }
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
        alert('Failed to load admin data: ' + (error.message || 'Unknown error'));
    }
}

// Utility functions
function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');

    if (overlay && messageEl) {
        messageEl.textContent = message || 'Processing...';
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function getReadableDocType(type) {
    switch (type) {
        case 'cv': return 'CV/Resume';
        case 'cover': return 'Cover Letter';
        case 'both': return 'CV & Cover Letter';
        default: return 'Document';
    }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
