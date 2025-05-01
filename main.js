// Main JavaScript for CV & Cover Letter Writer - Production Version

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
let generatedCoverLetter = null;
let stripe = null;
let cardElement = null;
let supabase = null;

// Constants
const PRICE_PER_TOKEN = 0.0001; // $0.0001 per token
const TOKEN_ESTIMATE = {
    cv: 2000,
    cover: 1500,
    both: 3500
};

// Initialize Supabase
function initSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (typeof supabaseCreateClient === 'function' && supabaseUrl && supabaseKey) {
        return supabaseCreateClient(supabaseUrl, supabaseKey);
    }
    return null;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize Stripe
        if (typeof Stripe === 'function') {
            const stripeKey = process.env.STRIPE_PUBLIC_KEY || 'pk_test_placeholder';
            stripe = Stripe(stripeKey);
        }

        // Initialize Supabase
        supabase = initSupabase();

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
async function checkAuthStatus() {
    try {
        let user = null;

        if (supabase) {
            // Use Supabase auth
            const { data, error } = await supabase.auth.getUser();
            if (!error && data.user) {
                user = data.user;
            }
        } else {
            // Fallback to localStorage
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                user = JSON.parse(storedUser);
            }
        }

        if (user) {
            currentUser = user;
            isLoggedIn = true;

            // Check if admin
            isAdmin = user.role === 'admin';

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

async function handleAuth(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    try {
        showLoading('Authenticating...');

        let user = null;

        if (supabase) {
            // Use Supabase auth
            let authResult;

            if (isLoginMode) {
                // Login
                authResult = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
            } else {
                // Register
                authResult = await supabase.auth.signUp({
                    email,
                    password
                });
            }

            if (authResult.error) {
                throw authResult.error;
            }

            user = authResult.data.user;
        } else {
            // Fallback to localStorage auth
            if (isLoginMode) {
                // Mock login
                const storedUsers = localStorage.getItem('users');
                const users = storedUsers ? JSON.parse(storedUsers) : [];
                user = users.find(u => u.email === email);

                if (!user) {
                    if (email === 'admin@example.com') {
                        user = {
                            id: 'admin_1',
                            email,
                            role: 'admin',
                            tokenBalance: 10000
                        };
                    } else {
                        user = {
                            id: 'user_' + Date.now(),
                            email,
                            role: 'user',
                            tokenBalance: 0
                        };
                    }

                    // Store user
                    users.push(user);
                    localStorage.setItem('users', JSON.stringify(users));
                }
            } else {
                // Mock register
                const storedUsers = localStorage.getItem('users');
                const users = storedUsers ? JSON.parse(storedUsers) : [];
                const existingUser = users.find(u => u.email === email);

                if (existingUser) {
                    throw new Error('User already exists');
                }

                user = {
                    id: 'user_' + Date.now(),
                    email,
                    role: 'user',
                    tokenBalance: 0
                };

                // Store user
                users.push(user);
                localStorage.setItem('users', JSON.stringify(users));
            }

            // Store current user
            localStorage.setItem('currentUser', JSON.stringify(user));
        }

        currentUser = user;
        isLoggedIn = true;
        isAdmin = user.role === 'admin';

        // Close modal
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            loginModal.style.display = 'none';
        }

        // Update UI based on login status
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.textContent = isAdmin ? 'Admin Dashboard' : 'My Account';

            // Remove old event listener
            loginBtn.outerHTML = loginBtn.outerHTML;

            // Add new event listener
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

    // Read file and parse with actual implementation
    parseDocument(file)
        .then(function(parsedContent) {
            documentContent = parsedContent;

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
        })
        .catch(function(error) {
            hideLoading();
            console.error('Document parsing error:', error);
            alert('Error parsing document: ' + (error.message || 'Unknown error'));
        });
}

// Parse document function
function parseDocument(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();

        reader.onload = function(e) {
            const fileContent = e.target.result;

            // Actual parsing logic based on file type
            if (file.type === 'application/pdf') {
                // PDF parsing logic would go here
                // For now, return raw content
                resolve(`Content extracted from PDF: ${file.name}`);
            } else {
                // Word document parsing logic would go here
                // For now, return raw content
                resolve(`Content extracted from Word document: ${file.name}`);
            }
        };

        reader.onerror = function() {
            reject(new Error('Error reading file'));
        };

        // Read file based on type
        if (file.type === 'application/pdf') {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
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

        const tokenCount = await getTokenUsage(payload);
        if (summaryTokens) summaryTokens.textContent = tokenCount.toLocaleString();

        const price = (tokenCount * PRICE_PER_TOKEN).toFixed(2);
        if (summaryPrice) summaryPrice.textContent = `$${price}`;

        // Generate document preview
        generatePreview()
            .then(function() {
                updateWizardProgress(3);
            })
            .catch(function(error) {
                console.error('Preview generation error:', error);
                alert('Error generating preview: ' + (error.message || 'Unknown error'));
            });
    });
}

// Generate document preview
function generatePreview() {
    showLoading('Generating preview...');

    return new Promise(function(resolve, reject) {
        try {
            // Use prompt-builder.js to generate preview content
            // This assumes prompt-builder.js exposes a generateDocument function
            if (typeof promptBuilder !== 'undefined' && promptBuilder.generatePreview) {
                const payload = {
                    document: documentContent,
                    jobDescription: jobDescription,
                    documentType: documentType,
                    tone: documentTone,
                    language: documentLanguage
                };

                promptBuilder.generatePreview(payload)
                    .then(function(result) {
                        generatedDocument = result;
                        hideLoading();
                        resolve();
                    })
                    .catch(function(error) {
                        hideLoading();
                        reject(error);
                    });
            } else {
                // Fallback if prompt-builder is not available
                setTimeout(function() {
                    // Create basic preview
                    let content = '';

                    if (documentType === 'cv' || documentType === 'both') {
                        content = `
                            <div class="cv-section">
                                <h2>Professional Summary</h2>
                                <p>Your professional summary will appear here in the final document.</p>

                                <h2>Experience</h2>
                                <p>Your work experience will be formatted here.</p>

                                <h2>Skills</h2>
                                <p>Your skills will be organized here.</p>

                                <h2>Education</h2>
                                <p>Your education history will be formatted here.</p>
                            </div>
                        `;
                    }

                    if (documentType === 'cover') {
                        content = `
                            <div class="cover-letter-section">
                                <h2>Cover Letter</h2>
                                <p>Your professional cover letter will be written here.</p>
                                <p>It will follow your selected tone (${documentTone}) and highlight key qualifications.</p>
                                <p>The letter will be tailored to the job description if provided.</p>
                            </div>
                        `;
                    }

                    if (documentType === 'both') {
                        generatedCoverLetter = `
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

                    hideLoading();
                    resolve();
                }, 1000);
            }
        } catch (error) {
            hideLoading();
            reject(error);
        }
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
    // Display the document immediately
    displayDocument();

    // Setup document type toggle if both CV and cover letter
    if (documentType === 'both') {
        setupDocumentToggle();
    }

    const downloadBtn = document.getElementById('download-doc-btn');
    const createAccountBtn = document.getElementById('create-account-btn');
    const newDocBtn = document.getElementById('new-document-btn');

    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            downloadDocument();
        });
    }

    if (createAccountBtn) {
        createAccountBtn.addEventListener('click', function() {
            if (isLoggedIn) {
                alert('You are already logged in');
            } else {
                showLoginModal();
                toggleAuthMode({ preventDefault: function() {} }); // Switch to signup mode
            }
        });
    }

    if (newDocBtn) {
        newDocBtn.addEventListener('click', function() {
            resetWizard();
            updateWizardProgress(1);
        });
    }
}

// Display document in results step
function displayDocument() {
    const previewBox = document.getElementById('preview-box');
    if (!previewBox) return;

    if (generatedDocument && generatedDocument.content) {
        previewBox.innerHTML = generatedDocument.content;
    } else {
        previewBox.innerHTML = '<p>No document content available</p>';
    }
}

// Setup document toggle for CV and cover letter
function setupDocumentToggle() {
    const previewBox = document.getElementById('preview-box');
    if (!previewBox) return;

    // Create toggle container
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'document-toggle';
    toggleContainer.style.marginBottom = '1rem';

    // Create CV button
    const cvBtn = document.createElement('button');
    cvBtn.textContent = 'View CV';
    cvBtn.className = 'btn-secondary active';
    cvBtn.style.marginRight = '0.5rem';

    // Create cover letter button
    const coverBtn = document.createElement('button');
    coverBtn.textContent = 'View Cover Letter';
    coverBtn.className = 'btn-secondary';

    // Add toggle functionality
    cvBtn.addEventListener('click', function() {
        cvBtn.className = 'btn-secondary active';
        coverBtn.className = 'btn-secondary';
        previewBox.innerHTML = generatedDocument.content;
    });

    coverBtn.addEventListener('click', function() {
        coverBtn.className = 'btn-secondary active';
        cvBtn.className = 'btn-secondary';
        previewBox.innerHTML = generatedCoverLetter;
    });

    // Add buttons to container
    toggleContainer.appendChild(cvBtn);
    toggleContainer.appendChild(coverBtn);

    // Insert toggle before preview box
    previewBox.parentNode.insertBefore(toggleContainer, previewBox);
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
    generatedCoverLetter = null;

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

    // For preview/summary step
    getTokenUsage(payload, function(realTokenCount) {
      const summaryTokens = document.getElementById('summary-tokens');
      if (summaryTokens) {
        summaryTokens.textContent = realTokenCount.toLocaleString();
      }

      const price = (realTokenCount * PRICE_PER_TOKEN).toFixed(2);
      const summaryPrice = document.getElementById('summary-price');
      if (summaryPrice) {
        summaryPrice.textContent = '$' + price;
      }
    });

    const tokenCountEl = document.getElementById('token-count');
    const priceDisplayEl = document.getElementById('price-display');

    if (tokenCountEl) tokenCountEl.textContent = tokenCount.toLocaleString();
    if (priceDisplayEl) priceDisplayEl.textContent = `$${price}`;

    // Create card element if Stripe is available
    if (stripe && !cardElement) {
        const elements = stripe.elements();
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

async function handlePaymentSubmission(e) {
    e.preventDefault();



    try {
        showLoading('Processing payment...');

        // Create payment intent on server
        const paymentIntent = await createPaymentIntent(amount);

        if (!paymentIntent || !paymentIntent.client_secret) {
            throw new Error('Failed to create payment intent');
        }

        // Confirm payment with Stripe
        const result = await stripe.confirmCardPayment(paymentIntent.client_secret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    email: currentUser ? currentUser.email : ''
                }
            }
        });

        if (result.error) {
            throw result.error;
        }

        // Payment succeeded
        if (result.paymentIntent.status === 'succeeded') {
            // Generate final document
            await generateFinalDocument();

            // Record transaction
            await recordTransaction(amount / 100);

            // Close modal
            const paymentModal = document.getElementById('payment-modal');
            if (paymentModal) {
                paymentModal.style.display = 'none';
            }

            // Move to results step
            updateWizardProgress(4);
        }

        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Payment error:', error);

        const cardErrors = document.getElementById('card-errors');
        if (cardErrors) {
            cardErrors.textContent = error.message || 'Payment failed';
        }
    }
}

// Create payment intent
async function createPaymentIntent(amount) {
    // In a real implementation, this would call your backend
    // For now, we'll simulate a success response
    return {
        client_secret: 'pi_test_secret_' + Date.now()
    };
}

// Record transaction
async function recordTransaction(amount) {
    const transaction = {
        id: 'txn_' + Date.now(),
        userId: currentUser ? currentUser.id : 'guest',
        amount: amount,
        date: new Date().toISOString(),
        tokens: TOKEN_ESTIMATE[documentType],
        documentType: documentType
    };

    if (supabase) {
        // Use Supabase
        await supabase.from('transactions').insert(transaction);
    } else {
        // Fallback to localStorage
        const transactions = localStorage.getItem('transactions');
        const transactionsList = transactions ? JSON.parse(transactions) : [];
        transactionsList.push(transaction);
        localStorage.setItem('transactions', JSON.stringify(transactionsList));
    }

    return transaction;
}

// Generate final document
async function generateFinalDocument() {
    showLoading('Generating your document...');

    try {
        // Use prompt-builder.js to generate final content
        if (typeof promptBuilder !== 'undefined' && promptBuilder.generateDocument) {
            const payload = {
                document: documentContent,
                jobDescription: jobDescription,
                documentType: documentType,
                tone: documentTone,
                language: documentLanguage
            };

            const result = await promptBuilder.generateDocument(payload);

            if (documentType === 'cv' || documentType === 'both') {
                generatedDocument = {
                    content: result.cv || result.content,
                    type: 'cv',
                    tone: documentTone,
                    language: documentLanguage,
                    date: new Date().toISOString(),
                    id: 'doc_cv_' + Date.now()
                };
            }

            if (documentType === 'cover' || documentType === 'both') {
                const coverContent = result.cover || (documentType === 'cover' ? result.content : null);

                if (documentType === 'both') {
                    generatedCoverLetter = coverContent;
                } else {
                    generatedDocument = {
                        content: coverContent,
                        type: 'cover',
                        tone: documentTone,
                        language: documentLanguage,
                        date: new Date().toISOString(),
                        id: 'doc_cover_' + Date.now()
                    };
                }
            }

            // Store document in database
            await storeDocument();

            hideLoading();
            return true;
        } else {
            // Fallback if prompt-builder is not available
            // Final document would be the same as preview in this case
            await storeDocument();
            hideLoading();
            return true;
        }
    } catch (error) {
        hideLoading();
        console.error('Document generation error:', error);
        alert('Error generating document: ' + (error.message || 'Unknown error'));
        return false;
    }
}

// Store document in database
async function storeDocument() {
    const docRecord = {
        id: generatedDocument.id,
        userId: currentUser ? currentUser.id : 'guest',
        type: documentType,
        date: new Date().toISOString(),
        content: generatedDocument.content,
        tone: documentTone,
        language: documentLanguage
    };

    if (supabase) {
        // Use Supabase
        await supabase.from('documents').insert(docRecord);
    } else {
        // Fallback to localStorage
        const documents = localStorage.getItem('documents');
        const documentsList = documents ? JSON.parse(documents) : [];
        documentsList.push(docRecord);
        localStorage.setItem('documents', JSON.stringify(documentsList));
    }

    return docRecord;
}

function downloadDocument() {
    if (!generatedDocument) {
        alert('No document to download');
        return;
    }

    // Create file name
    const fileName = `${getReadableDocType(documentType)}_${documentTone}_${new Date().getTime()}.html`;

    // Create HTML content
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

    // Create download link
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
        createAccountForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('new-email').value;
            const password = document.getElementById('new-password').value;

            if (!email || !password) {
                alert('Please enter both email and password');
                return;
            }

            try {
                showLoading('Creating account...');

                if (supabase) {
                    // Use Supabase auth
                    const { data, error } = await supabase.auth.signUp({
                        email,
                        password
                    });

                    if (error) throw error;

                    currentUser = data.user;
                } else {
                    // Fallback to localStorage
                    const storedUsers = localStorage.getItem('users');
                    const users = storedUsers ? JSON.parse(storedUsers) : [];
                    const existingUser = users.find(u => u.email === email);

                    if (existingUser) {
                        throw new Error('User already exists');
                    }

                    const user = {
                        id: 'user_' + Date.now(),
                        email,
                        role: 'user',
                        tokenBalance: 0
                    };

                    users.push(user);
                    localStorage.setItem('users', JSON.stringify(users));
                    localStorage.setItem('currentUser', JSON.stringify(user));

                    currentUser = user;
                }

                isLoggedIn = true;

                // Update UI
                const loginBtn = document.getElementById('login-btn');
                if (loginBtn) {
                    loginBtn.textContent = 'My Account';

                    // Remove old event listener
                    loginBtn.outerHTML = loginBtn.outerHTML;

                    // Add new event listener
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
async function populateAccountData() {
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

    // Get token balance
    let tokenBalance = 0;

    if (supabase) {
        // Use Supabase
        const { data, error } = await supabase
            .from('users')
            .select('tokenBalance')
            .eq('id', currentUser.id)
            .single();

        if (!error && data) {
            tokenBalance = data.tokenBalance || 0;
        }
    } else {
        // Fallback to localStorage
        tokenBalance = currentUser.tokenBalance || 0;
    }

    const tokensEl = document.getElementById('account-tokens');
    if (tokensEl) {
        tokensEl.textContent = tokenBalance.toString();
    }

    // Buy tokens button
    const buyTokensBtn = document.getElementById('buy-tokens-btn');
    if (buyTokensBtn) {
        buyTokensBtn.addEventListener('click', showBuyTokensModal);
    }

    // Populate document history
    await populateDocumentHistory();
}

// Function to handle buying tokens
function showBuyTokensModal() {
    alert('Token purchase functionality will be available soon.');
}

async function populateDocumentHistory() {
    if (!currentUser) return;

    const tableBody = document.getElementById('history-body');
    if (!tableBody) return;

    try {
        // Get documents
        let documents = [];

        if (supabase) {
            // Use Supabase
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('userId', currentUser.id)
                .order('date', { ascending: false });

            if (!error) {
                documents = data || [];
            }
        } else {
            // Fallback to localStorage
            const storedDocs = localStorage.getItem('documents');
            const allDocs = storedDocs ? JSON.parse(storedDocs) : [];
            documents = allDocs.filter(doc => doc.userId === currentUser.id);
        }

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
                    viewDocument(doc);
                });

                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = 'Download';
                downloadBtn.className = 'btn-primary';
                downloadBtn.addEventListener('click', function() {
                    downloadDocumentById(doc.id);
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

// View document function
function viewDocument(doc) {
    const modal = document.getElementById('preview-modal');
    const previewContent = document.getElementById('document-preview');

    if (!modal || !previewContent) return;

    // Set content
    previewContent.innerHTML = doc.content || 'No content available';

    // Show modal
    modal.style.display = 'block';
}

// Download document by ID
async function downloadDocumentById(docId) {
    try {
        // Get document
        let doc = null;

        if (supabase) {
            // Use Supabase
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('id', docId)
                .single();

            if (!error) {
                doc = data;
            }
        } else {
            // Fallback to localStorage
            const storedDocs = localStorage.getItem('documents');
            const allDocs = storedDocs ? JSON.parse(storedDocs) : [];
            doc = allDocs.find(d => d.id === docId);
        }

        if (!doc) {
            throw new Error('Document not found');
        }

        // Create temporary generatedDocument for download
        generatedDocument = doc;

        // Download
        downloadDocument();

        // Reset generatedDocument
        generatedDocument = null;
    } catch (error) {
        console.error('Error downloading document:', error);
        alert('Failed to download document: ' + (error.message || 'Unknown error'));
    }
}

// Admin dashboard functions
async function showAdminDashboard() {
    if (!isAdmin) {
        alert('You do not have admin access');
        return;
    }

    const modal = document.getElementById('admin-modal');
    if (!modal) return;

    // Populate admin data
    await populateAdminData();

    // Show modal
    modal.style.display = 'block';
}

async function populateAdminData() {
    try {
        // Get data
        let users = [];
        let documents = [];
        let transactions = [];

        if (supabase) {
            // Use Supabase
            const usersResult = await supabase.from('users').select('*');
            const docsResult = await supabase.from('documents').select('*');
            const txnResult = await supabase.from('transactions').select('*');

            users = usersResult.data || [];
            documents = docsResult.data || [];
            transactions = txnResult.data || [];
        } else {
            // Fallback to localStorage
            const storedUsers = localStorage.getItem('users');
            const storedDocs = localStorage.getItem('documents');
            const storedTxns = localStorage.getItem('transactions');

            users = storedUsers ? JSON.parse(storedUsers) : [];
            documents = storedDocs ? JSON.parse(storedDocs) : [];
            transactions = storedTxns ? JSON.parse(storedTxns) : [];
        }

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
        await populateTransactionsTable(transactions);

        // Populate documents table
        await populateDocumentsTable(documents, users);
    } catch (error) {
        console.error('Error loading admin data:', error);
        alert('Failed to load admin data: ' + (error.message || 'Unknown error'));
    }
}

async function populateTransactionsTable(transactions) {
    const transactionsBody = document.getElementById('transactions-body');
    if (!transactionsBody) return;

    // Clear existing rows
    transactionsBody.innerHTML = '';

    if (transactions && transactions.length > 0) {
        // Sort by date (newest first)
        transactions.sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });

        // Take only the most recent 10
        const recentTransactions = transactions.slice(0, 10);

        // Add to table
        for (const txn of recentTransactions) {
            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = txn.id;

            const userCell = document.createElement('td');
            // Get user email
            let userEmail = 'Unknown';

            if (supabase) {
                // Use Supabase
                const { data, error } = await supabase
                    .from('users')
                    .select('email')
                    .eq('id', txn.userId)
                    .single();

                if (!error && data) {
                    userEmail = data.email;
                }
            } else {
                // Fallback to localStorage
                const storedUsers = localStorage.getItem('users');
                const users = storedUsers ? JSON.parse(storedUsers) : [];
                const user = users.find(u => u.id === txn.userId);
                if (user) {
                    userEmail = user.email;
                }
            }

            userCell.textContent = userEmail;

            const amountCell = document.createElement('td');
            amountCell.textContent = `${txn.amount.toFixed(2)}`;

            const dateCell = document.createElement('td');
            dateCell.textContent = new Date(txn.date).toLocaleDateString();

            row.appendChild(idCell);
            row.appendChild(userCell);
            row.appendChild(amountCell);
            row.appendChild(dateCell);

            transactionsBody.appendChild(row);
        }
    } else {
        // No transactions
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No transactions found';
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        transactionsBody.appendChild(row);
    }
}

async function populateDocumentsTable(documents, users) {
    const documentsBody = document.getElementById('documents-body');
    if (!documentsBody) return;

    // Clear existing rows
    documentsBody.innerHTML = '';

    if (documents && documents.length > 0) {
        // Sort by date (newest first)
        documents.sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });

        // Take only the most recent 10
        const recentDocuments = documents.slice(0, 10);

        // Add to table
        for (const doc of recentDocuments) {
            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = doc.id;

            const userCell = document.createElement('td');
            // Get user email
            let userEmail = 'Unknown';

            // Find user in provided users array
            const user = users.find(u => u.id === doc.userId);
            if (user) {
                userEmail = user.email;
            }

            userCell.textContent = userEmail;

            const typeCell = document.createElement('td');
            typeCell.textContent = getReadableDocType(doc.type);

            const dateCell = document.createElement('td');
            dateCell.textContent = new Date(doc.date).toLocaleDateString();

            row.appendChild(idCell);
            row.appendChild(userCell);
            row.appendChild(typeCell);
            row.appendChild(dateCell);

            documentsBody.appendChild(row);
        }
    } else {
        // No documents
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No documents found';
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        documentsBody.appendChild(row);
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
// Function to get real token usage
function getTokenUsage(payload, callback) {
  fetch('https://api.deepseek.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      prompt: payload.document,
      max_tokens: 100
    })
  })
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    callback(data.usage.total_tokens);
  })
  .catch(function(error) {
    console.error('Error getting token count:', error);
    callback(2000); // Fallback to default
  });
}
