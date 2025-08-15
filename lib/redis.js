// lib/redis.js
import Redis from 'ioredis';

let redis;

if (typeof window === 'undefined') {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) throw new Error('UPSTASH_REDIS_URL is not set');
  redis = new Redis(url);
} else {
  redis = null;
}

export default redis;
