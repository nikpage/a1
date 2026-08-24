#!/usr/bin/env node
// Delete one bullet from the stored master CV by exact substring.
// The master is the only source of fact for both generators, so a line the
// candidate never said keeps reappearing in every document until it is removed
// here. Read-modify-write on cv_data.master_cv, no AI call.
//
//   node scripts/master-drop-bullet.mjs "<substring>"
import { createClient } from '@supabase/supabase-js';

const needle = process.argv[2];
if (!needle) { console.error('usage: node scripts/master-drop-bullet.mjs "<substring>"'); process.exit(1); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user } = await sb.from('users').select('user_id').eq('email', 'npx10111@gmail.com').single();
const { data } = await sb.from('cv_data').select('master_cv').eq('user_id', user.user_id).single();

const master = data.master_cv;
const removed = [];
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (node && typeof node === 'object') {
    if (Array.isArray(node.bullets)) {
      node.bullets = node.bullets.filter((b) => {
        const drop = typeof b === 'string' && b.includes(needle);
        if (drop) removed.push(b);
        return !drop;
      });
    }
    Object.values(node).forEach(walk);
  }
};
walk(master);

console.log(`removing ${removed.length}:`);
for (const r of removed) console.log('  - ' + r);
if (removed.length) {
  const { error } = await sb.from('cv_data').update({ master_cv: master }).eq('user_id', user.user_id);
  console.log('save error:', error || 'none');
}
const { data: after } = await sb.from('cv_data').select('master_cv').eq('user_id', user.user_id).single();
console.log('still present:', JSON.stringify(after.master_cv).includes(needle));
