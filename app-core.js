// Main application initialization
document.addEventListener('DOMContentLoaded', function() {
    // Initialize services
    initSupabase();
    initStripe();
    
    // Render initial page
    renderPage('landing');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check auth status
    checkAuthStatus();
});

// Authentication functions
function showLoginModal() { /* ... */ }
function toggleAuthMode() { /* ... */ }
function handleAuth() { /* ... */ }
function checkAuthStatus() { /* ... */ }

// Core rendering functions
function renderPage() { /* ... */ }
function setupEventListeners() { /* ... */ }

// Utility functions
function showLoading() { /* ... */ }
function hideLoading() { /* ... */ }
function getReadableDocType() { /* ... */ }
function capitalizeFirstLetter() { /* ... */ }