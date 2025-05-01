// Main JavaScript for CV & Cover Letter Writer
// This file will work in conjunction with prompt-builder.js that includes AI prompt handling

// Supabase client initialization will be loaded from a separate script in production
// For now we'll mock the functions we need

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
let stripe = null;
let cardElement = null;

// Constants
const PRICE_PER_TOKEN = 0.0001; // $0.0001 per token
const TOKEN_ESTIMATE = {
    cv: 2000,
    cover: 1500,
    both: 3500
};

// Setup global event listeners
function setupEventListeners() {
    // Login button in nav
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', showLoginModal);
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

        let result;
        if (isLoginMode) {
            // In production, use Supabase auth.signInWithPassword()
            result = await mockSupabase.auth.signIn({ email, password });
        } else {
            // In production, use Supabase auth.signUp()
            result = await mockSupabase.auth.signUp({ email, password });
        }

        if (result.error) throw result.error;

        currentUser = result.data.user;
        isLoggedIn = true;
        isAdmin = currentUser.role === 'admin';

        // Close modal
        document.getElementById('login-modal').style.display = 'none';

        // Up                    date: new Date().toISOString()
                };

                mockSupabase.from('documents').insert(docRecord);

                hideLoading();
                resolve();
            }, 3000);
        });
    } catch (error) {
        hideLoading();
        console.error('Document generation error:', error);
        alert('Error generating document: ' + (error.message || 'Unknown error'));
        throw error;
    }
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
        viewDocsBtn.addEventListener('click', () => {
            renderPage('wizard');
            updateWizardProgress(4);
        });
    }

    if (createAccountForm) {
        createAccountForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('new-email').value;
            const password = document.getElementById('new-password').value;

            if (!email || !password) {
                alert('Please enter both email and password');
                return;
            }

            try {
                showLoading('Creating account...');

                // In production, use Supabase auth.signUp()
                const result = await mockSupabase.auth.signUp({ email, password });

                if (result.error) throw result.error;

                currentUser = result.data.user;
                isLoggedIn = true;

                // Update UI
                const loginBtn = document.getElementById('login-btn');
                if (loginBtn) {
                    loginBtn.textContent = 'My Account';
                    loginBtn.removeEventListener('click', showLoginModal);
                    loginBtn.addEventListener('click', () => {
                        renderPage('account');
                    });
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
        loginLink.addEventListener('click', (e) => {
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
    getTokenBalance(currentUser.id).then(balance => {
        const tokensEl = document.getElementById('account-tokens');
        if (tokensEl) {
            tokensEl.textContent = balance.toString();
        }
    });

    // Buy tokens button
    const buyTokensBtn = document.getElementById('buy-tokens-btn');
    if (buyTokensBtn) {
        buyTokensBtn.addEventListener('click', showBuyTokensModal);
    }

    // Populate document history
    populateDocumentHistory();
}

// Get token balance from database
async function getTokenBalance(userId) {
    // In production, this would query Supabase
    const { data, error } = await mockSupabase.from('users').select().eq('id', userId);

    if (error) throw error;

    if (data && data.length > 0) {
        return data[0].tokenBalance || 0;
    }

    return 0;
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
        // In production, use Supabase query
        const { data, error } = await mockSupabase.from('documents')
            .select().eq('userId', currentUser.id);

        if (error) throw error;

        // Clear table
        tableBody.innerHTML = '';

        if (data && data.length > 0) {
            data.forEach(doc => {
                const row = document.createElement('tr');

                const dateCell = document.createElement('td');
                dateCell.textContent = new Date(doc.date).toLocaleDateString();

                const typeCell = document.createElement('td');
                typeCell.textContent = getReadableDocType(doc.type);

                const nameCell = document.createElement('td');
                nameCell.textContent = `Document ${doc.id.substring(doc.id.length - 5)}`;

                const actionsCell = document.createElement('td');

                const viewBtn = document.createElement('button');
                viewBtn.textContent = 'View';
                viewBtn.className = 'btn-secondary';
                viewBtn.style.marginRight = '5px';
                viewBtn.addEventListener('click', () => {
                    // Mock viewing document
                    alert('View document functionality would be implemented here');
                });

                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = 'Download';
                downloadBtn.className = 'btn-primary';
                downloadBtn.addEventListener('click', () => {
                    // Mock download document
                    alert('Download document functionality would be implemented here');
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

async function populateAdminData() {
    try {
        // Get actual data from database
        const userCount = await getUserCount();
        const docCount = await getDocumentCount();
        const revenueData = await getRevenueData();

        // Update dashboard
        document.getElementById('user-count').textContent = userCount;
        document.getElementById('doc-count').textContent = docCount;
        document.getElementById('revenue').textContent = `${revenueData.total.toFixed(2)}`;

        // Load transactions
        await loadTransactions();

        // Load documents
        await loadDocuments();
    } catch (error) {
        console.error('Error loading admin data:', error);
        alert('Failed to load admin data: ' + (error.message || 'Unknown error'));
    }
}

// Get actual user count from database
async function getUserCount() {
    // In production, this would query Supabase
    const { data, error } = await mockSupabase.from('users').select();

    if (error) throw error;

    return data ? data.length : 0;
}

// Get actual document count from database
async function getDocumentCount() {
    // In production, this would query Supabase
    const { data, error } = await mockSupabase.from('documents').select();

    if (error) throw error;

    return data ? data.length : 0;
}

// Get actual revenue data from database
async function getRevenueData() {
    // In production, this would query Supabase
    const { data, error } = await mockSupabase.from('transactions').select();

    if (error) throw error;

    // Calculate total
    let total = 0;
    if (data && data.length > 0) {
        total = data.reduce((sum, txn) => sum + (txn.amount || 0), 0);
    }

    return { total, transactions: data || [] };
}

// Load transactions for admin dashboard
async function loadTransactions() {
    const transactionsBody = document.getElementById('transactions-body');
    if (!transactionsBody) return;

    // Clear existing rows
    transactionsBody.innerHTML = '';

    // Get transactions from database
    const { data, error } = await mockSupabase.from('transactions').select();

    if (error) throw error;

    if (data && data.length > 0) {
        // Sort by date (newest first)
        data.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Take only the most recent 10
        const recentTransactions = data.slice(0, 10);

        // Add to table
        recentTransactions.forEach(txn => {
            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = txn.id;

            const userCell = document.createElement('td');
            // Get user email from user ID
            getUserEmail(txn.userId).then(email => {
                userCell.textContent = email;
            });

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

// Load documents for admin dashboard
async function loadDocuments() {
    const documentsBody = document.getElementById('documents-body');
    if (!documentsBody) return;

    // Clear existing rows
    documentsBody.innerHTML = '';

    // Get documents from database
    const { data, error } = await mockSupabase.from('documents').select();

    if (error) throw error;

    if (data && data.length > 0) {
        // Sort by date (newest first)
        data.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Take only the most recent 10
        const recentDocuments = data.slice(0, 10);

        // Add to table
        recentDocuments.forEach(doc => {
            const row = document.createElement('tr');

            const idCell = document.createElement('td');
            idCell.textContent = doc.id;

            const userCell = document.createElement('td');
            // Get user email from user ID
            getUserEmail(doc.userId).then(email => {
                userCell.textContent = email;
            });

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

// Get user email from user ID
async function getUserEmail(userId) {
    // In production, this would query Supabase
    const { data, error } = await mockSupabase.from('users').select().eq('id', userId);

    if (error) throw error;

    if (data && data.length > 0) {
        return data[0].email;
    }

    return 'Unknown User';
}

// Utility functions
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');

    if (overlay && messageEl) {
        messageEl.textContent = message;
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
 UI based on login status
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.textContent = isAdmin ? 'Admin Dashboard' : 'My Account';
            loginBtn.removeEventListener('click', showLoginModal);
            loginBtn.addEventListener('click', () => {
                if (isAdmin) {
                    showAdminDashboard();
                } else {
                    renderPage('account');
                }
            });
        }

        hideLoading();

        // If admin, show dashboard
        if (isAdmin) {
            showAdminDashboard();
        }

    } catch (error) {
        hideLoading();
        console.error('Auth error:', error);
        alert(`Authentication failed: ${error.message || 'Unknown error'}`);
    }
}

// Modal close buttons
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    // Close modals when clicking outside
    window.addEventListener('click', event => {
        document.querySelectorAll('.modal').forEach(modal => {
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
    mainContent.appendChild(template.content.cloneNode(true));

    // Additional setup based on page
    switch (page) {
        case 'landing':
            document.getElementById('start-btn').addEventListener('click', () => {
                renderPage('wizard');
                updateWizardProgress(1);
            });
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
        // In production, use Supabase auth.getUser()
        const { data, error } = await mockSupabase.auth.getUser();

        if (error) throw error;

        if (data.user) {
            currentUser = data.user;
            isLoggedIn = true;

            // Check if admin
            isAdmin = data.user.role === 'admin';

            // Update UI based on login status
            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.textContent = isAdmin ? 'Admin Dashboard' : 'My Account';
                loginBtn.removeEventListener('click', showLoginModal);
                loginBtn.addEventListener('click', () => {
                    if (isAdmin) {
                        showAdminDashboard();
                    } else {
                        renderPage('account');
                    }
                });
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize Stripe
        stripe = Stripe('pk_test_placeholder'); // Replace with your Stripe public key in production

        // Render landing page
        renderPage('landing');

        // Add event listeners
        setupEventListeners();

        // Check if user is logged in (via Supabase)
        checkAuthStatus();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('An error occurred during initialization. Please refresh the page.');
    }
});
