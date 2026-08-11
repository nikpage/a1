// utils/generation-status.js
//
// Transient status of one background generation run, keyed by the client-minted
// generation_id and scoped to the user so one user can never poll another's run.
// The documents themselves are persisted to gen_data by the run; this is only
// the handshake that lets the browser stop polling — hence Redis with a TTL
// rather than a new table.

import { Redis } from '@upstash/redis';

const TTL_SECONDS = 1800; // 30 min — comfortably past the 15-min background budget

let _redis;
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

export function generationStatusKey(user_id, generation_id) {
  return `gen_status:${user_id}:${generation_id}`;
}

export async function publishGenerationStatus(user_id, generation_id, payload) {
  await getRedis().set(generationStatusKey(user_id, generation_id), JSON.stringify(payload), {
    ex: TTL_SECONDS,
  });
}

export async function readGenerationStatus(user_id, generation_id) {
  const raw = await getRedis().get(generationStatusKey(user_id, generation_id));
  if (!raw) return null;
  // @upstash/redis deserialises JSON payloads on the way out; a string means it
  // didn't, so parse it ourselves.
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}
