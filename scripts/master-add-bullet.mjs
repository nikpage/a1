#!/usr/bin/env node
// Add one bullet to a named company's entry in the stored master CV.
//   node scripts/master-add-bullet.mjs "<company>" "<bullet text>"
import { createClient } from '@supabase/supabase-js';

const [company, bullet] = process.argv.slice(2);
if (!company || !bullet) { console.error('usage: node scripts/master-add-bullet.mjs "<company>" "<bullet>"'); process.exit(1); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: user } = await sb.from('users').select('user_id').eq('email', 'npx10111@gmail.com').single();
const { data } = await sb.from('cv_data').select('master_cv').eq('user_id', user.user_id).single();

const master = data.master_cv;
let added = 0;
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (node && typeof node === 'object') {
    if (node.company === company && Array.isArray(node.bullets) && !node.bullets.includes(bullet)) {
      node.bullets.push(bullet);
      added++;
    }
    Object.values(node).forEach(walk);
  }
};
walk(master);
console.log(`added to ${added} entr${added === 1 ? 'y' : 'ies'} of "${company}"`);
if (added) {
  const { error } = await sb.from('cv_data').update({ master_cv: master }).eq('user_id', user.user_id);
  console.log('save error:', error || 'none');
}
