// js/key-manager.js
export class KeyManager {
    constructor() {
        this.keys = [];
        this.currentKeyIndex = 0;
        this.usageLog = [];
        this.pricingRates = {
            'deepseek-chat': { prompt: 0.00001, completion: 0.00003 }
        };
        this.loadKeys();
    }

    loadKeys() {
        // In Vercel, environment variables are accessible directly through process.env
        if (typeof process !== 'undefined' && process.env) {
            // Filter environment variables that start with DEEPSEEK_API_KEY
            this.keys = Object.keys(process.env)
                .filter(key => key.startsWith('DEEPSEEK_API_KEY'))
                .map(key => process.env[key])
                .filter(key => key && key.trim() !== ''); // Filter out empty keys

            if (this.keys.length === 0) {
                console.warn('No DeepSeek API keys found in Vercel environment variables');
                this.keys = [null]; // Add a null key as fallback
            } else {
                console.log(`Loaded ${this.keys.length} DeepSeek API keys from environment`);
            }
        } else {
            console.error('No environment detected or not running in a Vercel environment');
            this.keys = [null];
        }
    }

    getNextKey() {
        // Rotate through available keys
        if (this.keys.length === 0 || this.keys.every(k => k === null)) {
            return null;
        }

        const key = this.keys[this.currentKeyIndex];
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
        return key;
    }

    trackUsage(usageData, model = 'deepseek-chat') {
        const cost = this.calculateCost(usageData, model);
        const entry = {
            timestamp: new Date().toISOString(),
            model,
            ...usageData,
            estimated_cost: cost,
            key_index: this.currentKeyIndex
        };

        this.usageLog.push(entry);

        // In browser environments, store in localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const existingData = localStorage.getItem('deepseek_usage');
                const existingLog = existingData ? JSON.parse(existingData) : [];
                localStorage.setItem('deepseek_usage', JSON.stringify([...existingLog, entry]));
            } catch (error) {
                console.error('Failed to store usage data in localStorage:', error);
            }
        }

        console.log('API Usage:', entry);
        return entry;
    }

    calculateCost(usage, model) {
        const rates = this.pricingRates[model] || this.pricingRates['deepseek-chat'];
        return (usage.prompt_tokens/1000 * rates.prompt) + (usage.completion_tokens/1000 * rates.completion);
    }

    getUsageStats() {
        const totalTokens = this.usageLog.reduce((sum, e) => sum + (e.total_tokens || 0), 0);
        const totalCost = this.usageLog.reduce((sum, e) => sum + (e.estimated_cost || 0), 0);

        return {
            total_requests: this.usageLog.length,
            total_tokens: totalTokens,
            estimated_cost: totalCost,
            detailed_usage: [...this.usageLog],
            active_keys: this.keys.filter(k => k !== null).length
        };
    }

    // Method to check if valid keys are available
    hasValidKeys() {
        return this.keys.some(key => key !== null);
    }
}
