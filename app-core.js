// Global variables
let currentUser = null;
let supabase = null;
let stripe = null;

// Initialize Supabase
function initSupabase() {
    const supabaseUrl = 'https://your-project.supabase.co';
    const supabaseKey = 'your-anon-key';
    supabase = supabase.createClient(supabaseUrl, supabaseKey);
    return supabase;
}

// Initialize Stripe
function initStripe() {
    stripe = Stripe('pk_test_your_stripe_public_key');
    return stripe;
}

// Core rendering function
function renderPage(page) {
    const mainContent = document.getElementById('main-content');
    const template = document.getElementById(`${page}-template`);

    if (!template) {
        console.error(`Template not found for page: ${page}`);
        return;
    }

    mainContent.innerHTML = '';
    mainContent.appendChild(template.content.cloneNode(true));

    // Page-specific initialization
    switch(page) {
        case 'landing':
            document.getElementById('start-btn')?.addEventListener('click', () => {
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

// Authentication functions
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAlert('Please enter both email and password', 'error');
        return;
    }

    try {
        showLoading('Authenticating...');

        const { data, error } = isLoginMode
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });

        if (error) throw error;

        currentUser = data.user;
        renderPage(currentUser ? 'account' : 'landing');

    } catch (error) {
        showAlert(`Authentication failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Utility functions
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    document.body.prepend(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    if (overlay && messageEl) {
        messageEl.textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    initStripe();
    setupEventListeners();
    checkAuthStatus();
    renderPage('landing');
});
