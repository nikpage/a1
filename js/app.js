// ===== DEV VERSION =====
// js/app.js

// ===== Z4 VERSION =====
// js/app.js

// ✅ Anonymous session ID setup (NEW)
let userId = localStorage.getItem('userId');
if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('userId', userId);
}
window.appUserId = userId;

// App Controller — production ready

class AppController {
    constructor() {
        this.currentStep = 'upload'; // 'upload', 'review', 'checkout', 'admin'
        this.setupGlobalListeners();
        console.log('[AppController] Initialized.');
    }

    setupGlobalListeners() {
        // Listen for critical errors globally
        window.addEventListener('error', (event) => {
            console.error('[Global Error]', event.message);
            this.showGlobalError('An unexpected error occurred. Please refresh and try again.');
        });

        // Listen for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('[Unhandled Promise]', event.reason);
            this.showGlobalError('Something went wrong. Please refresh and try again.');
        });
    }

    changeStep(newStep) {
        console.log(`[AppController] Changing step: ${this.currentStep} ➔ ${newStep}`);
        this.currentStep = newStep;
        this.updateView();
    }

    updateView() {
        const sections = {
            upload: document.getElementById('upload-section'),
            review: document.getElementById('review-section'),
            checkout: document.getElementById('checkout-section'), // future
            admin: document.getElementById('admin-section')         // future
        };

        Object.keys(sections).forEach(section => {
            if (sections[section]) {
                sections[section].classList.add('hidden');
            }
        });

        if (sections[this.currentStep]) {
            sections[this.currentStep].classList.remove('hidden');
        }
    }

    showGlobalError(message) {
        alert(message); // You can replace this later with a modal for better UX
    }
}

// Initialize App when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});
