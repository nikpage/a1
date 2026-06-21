// js/key-manager.js
import { logger } from '../lib/logger.js';

export class KeyManager {
    constructor() {
        this.keys = [];
        this.currentKeyIndex = 0;
        this.usageLog = [];
        this.pricingRates = {
            // rates are USD per 1 000 tokens — verify at ai.google.dev/gemini-api/docs/pricing
            'gemini-2.5-flash-lite': { prompt: 0.0001,  completion: 0.0004 },
            'gemini-2.5-flash':      { prompt: 0.0003,  completion: 0.0025 },
            'gemini-3.5-flash':      { prompt: 0.0015,  completion: 0.009  }
        };
        this.loadKeys();
        this.currentKeyIndex = Math.floor(Math.random() * this.keys.length);

    }

    loadKeys() {
        if (typeof window !== 'undefined') {
            logger.warn('[KeyManager] running in browser – not loading any keys')
            this.keys = [null]
            return
        }

        if (typeof process !== 'undefined' && process.env) {
            const raw = process.env.GEMINI_API_KEYS || '';
            this.keys = raw.split(',').map(k => k.trim()).filter(k => k !== '');

            if (this.keys.length === 0) {
                logger.warn('[KeyManager] No Gemini keys found in GEMINI_API_KEYS')
                this.keys = [null]
            } else {
                logger.info(`[KeyManager] Loaded ${this.keys.length} Gemini keys`)
            }
        } else {
            logger.error('[KeyManager] Not in server environment')
            this.keys = [null]
        }
    }



    getNextKey() {
      if (this.keys.length === 0 || this.keys.every(k => k === null)) {
        logger.warn('[KeyManager] No valid Gemini keys available');
        return null;
      }

      const key = this.keys[this.currentKeyIndex];

      // Find the matching env var name
      const envKeyName = Object.entries(process.env).find(([name, value]) => value === key)?.[0];

      logger.debug(`[KeyManager] Using key: ${envKeyName} = ${key.slice(0, 12)}...`);

      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;
      return key;
    }


    trackUsage(usageData, model = 'gemini-3.5-flash') {
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
                const existingData = localStorage.getItem('gemini_usage');
                const existingLog = existingData ? JSON.parse(existingData) : [];
                localStorage.setItem('gemini_usage', JSON.stringify([...existingLog, entry]));
            } catch (error) {
                logger.error('Failed to store usage data in localStorage:', error);
            }
        }

              return entry;
    }

    calculateCost(usage, model) {
        const rates = this.pricingRates[model] || this.pricingRates['gemini-3.5-flash'];
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
