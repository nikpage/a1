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
        if (typeof process !== 'undefined' && process.env.DEEPSEEK_API_KEY) {
            this.keys = [process.env.DEEPSEEK_API_KEY];
        } else {
            console.error('No API keys available');
            this.keys = [null];
        }
    }

    trackUsage(usageData, model = 'deepseek-chat') {
        const cost = this.calculateCost(usageData, model);
        const entry = { timestamp: new Date().toISOString(), model, ...usageData, estimated_cost: cost };
        this.usageLog.push(entry);
        if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('deepseek_usage', JSON.stringify(this.usageLog));
        }
        console.log('API Usage:', entry);
    }

    calculateCost(usage, model) {
        const rates = this.pricingRates[model] || this.pricingRates['deepseek-chat'];
        return (usage.prompt_tokens/1000 * rates.prompt) + (usage.completion_tokens/1000 * rates.completion);
    }

    getUsageStats() {
        const totalTokens = this.usageLog.reduce((sum, e) => sum + e.total_tokens, 0);
        const totalCost = this.usageLog.reduce((sum, e) => sum + e.estimated_cost, 0);
        return { total_requests: this.usageLog.length, total_tokens: totalTokens, estimated_cost: totalCost, detailed_usage: [...this.usageLog] };
    }
}
