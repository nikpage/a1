// lib/redis.js
import Redis from 'ioredis';

let redis;

if (typeof window === 'undefined') {
  if (!process.env.UPSTASH_REDIS_URL) {
    throw new Error('Server Error: UPSTASH_REDIS_URL is not set.');
  }
  redis = new Redis(process.env.UPSTASH_REDIS_URL);
} else {
  redis = null;
}

export default redis;
