// app.js
class AppController {
    constructor() {
        this.keyManager = new KeyManager();
        this.documentUpload = new DocumentUpload(this.keyManager);

        // Initialize error tracking
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showGlobalError(event.error);
        });

        console.log('Application initialized with production configuration');
    }

    showGlobalError(error) {
        const errorDisplay = document.createElement('div');
        errorDisplay.className = 'global-error';
        errorDisplay.innerHTML = `
            <h3>Application Error</h3>
            <p>${error.message}</p>
            <button onclick="location.reload()">Reload</button>
        `;
        document.body.prepend(errorDisplay);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (!process.env.DEEPSEEK_API_KEY && localStorage.getItem('deepseek_keys')?.length === 0) {
        alert('Warning: No API key configured. Some features may not work.');
    }

    new AppController();
});
