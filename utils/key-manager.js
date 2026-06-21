// js/key-manager.js
import { logger } from '../lib/logger.js';

export class KeyManager {
    constructor() {
        this.keys = [];
        this.currentKeyIndex = 0;
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


    // Method to check if valid keys are available
    hasValidKeys() {
        return this.keys.some(key => key !== null);
    }
}
