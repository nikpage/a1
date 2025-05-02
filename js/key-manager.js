// key-manager.js (updated)
class KeyManager {
    constructor() {
        this.keys = [];
        this.currentKeyIndex = 0;
        this.usageLog = [];
        this.pricingRates = {
            'deepseek-chat': {
                prompt: 0.00001,    // $0.01 per 1K tokens (example rate)
                completion: 0.00003 // $0.03 per 1K tokens (example rate)
            }
        };
        this.loadKeys();
    }

    loadKeys() {
        // Priority 1: Vercel environment variable
        if (typeof process !== 'undefined' && process.env.DEEPSEEK_API_KEY) {
            this.keys = [process.env.DEEPSEEK_API_KEY];
            return;
        }

        // Priority 2: localStorage fallback
        const storedKeys = JSON.parse(localStorage.getItem('deepseek_keys') || '[]');
        if (storedKeys.length > 0) {
            this.keys = storedKeys;
        }

        if (this.keys.length === 0) {
            console.error('No API keys available - using null key (requests will fail)');
            this.keys = [null]; // Prevent crashes but requests will fail
        }
    }

    trackUsage(usageData, model = 'deepseek-chat') {
        const cost = this.calculateCost(usageData, model);
        const entry = {
            timestamp: new Date().toISOString(),
            model,
            ...usageData,
            estimated_cost: cost
        };

        this.usageLog.push(entry);
        localStorage.setItem('deepseek_usage', JSON.stringify(this.usageLog));

        console.log('API Usage:', {
            model,
            prompt_tokens: usageData.prompt_tokens,
            completion_tokens: usageData.completion_tokens,
            total_tokens: usageData.total_tokens,
            estimated_cost: cost
        });
    }

    calculateCost(usage, model) {
        const rates = this.pricingRates[model] || this.pricingRates['deepseek-chat'];
        return (
            (usage.prompt_tokens / 1000 * rates.prompt) +
            (usage.completion_tokens / 1000 * rates.completion)
        );
    }

    getUsageStats() {
        const totalTokens = this.usageLog.reduce((sum, entry) => sum + entry.total_tokens, 0);
        const totalCost = this.usageLog.reduce((sum, entry) => sum + (entry.estimated_cost || 0), 0);

        return {
            total_requests: this.usageLog.length,
            total_tokens,
            estimated_cost: totalCost,
            detailed_usage: [...this.usageLog] // Clone array
        };
    }


}
