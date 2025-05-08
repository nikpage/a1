// ===== Z4 VERSION =====
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
        if (typeof process !== 'undefined' && process.env) {
            this.keys = Object.keys(process.env)
                .filter(key => key.startsWith('DEEPSEEK_API_KEY'))
                .map(key => process.env[key]);

            if (this.keys.length === 0) {
                console.error('No API keys found');
                this.keys = [null];
            }
        } else {
            console.error('No environment detected');
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
