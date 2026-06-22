// scripts/grant-tokens.mjs
//
// Owner tool: grant free paid-tokens to a specific account (marketing, friends,
// comps). Uses the existing add_tokens RPC — never a read-modify-write.
//
// Usage (env injected by Doppler):
//   doppler run -- node scripts/grant-tokens.mjs <email|user_id> <amount>
//
// Examples:
//   doppler run -- node scripts/grant-tokens.mjs jane@example.com 10
//   doppler run -- node scripts/grant-tokens.mjs user_abc123 3

import { addTokens, getUserByEmail, getUser } from '../utils/database.js';

const [, , who, amountRaw] = process.argv;
const amount = Number(amountRaw);

if (!who || !Number.isInteger(amount) || amount <= 0) {
  console.error('Usage: doppler run -- node scripts/grant-tokens.mjs <email|user_id> <positive integer amount>');
  process.exit(1);
}

const isEmail = who.includes('@');
const user = isEmail ? await getUserByEmail(who) : await getUser(who);

if (!user || !user.user_id) {
  console.error(`No user found for ${isEmail ? 'email' : 'user_id'}: ${who}`);
  process.exit(1);
}

const updated = await addTokens(user.user_id, amount);
console.log(`Granted ${amount} token(s) to ${user.email || user.user_id}. New balance: ${updated?.tokens ?? '(unknown)'}`);
