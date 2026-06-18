// lib/redis.js
import Redis from 'ioredis';

let _redis;
function getRedis() {
  if (_redis) return _redis;
  if (typeof window !== 'undefined') return null;
  if (!process.env.UPSTASH_REDIS_URL) throw new Error('Server Error: UPSTASH_REDIS_URL is not set.');
  _redis = new Redis(process.env.UPSTASH_REDIS_URL);
  return _redis;
}

const redis = new Proxy({}, { get: (_, prop) => { const r = getRedis(); return r ? r[prop] : undefined; } });
export default redis;
