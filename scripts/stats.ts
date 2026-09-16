// Private admin stats. Prints ONLY aggregate numbers — how many couples formed,
// how many people that is, and how many submitted. No names, no rolls, no who.
// This is the one aggregate the design lets an admin see, and it's computed the
// same way the reveal is.
//
//   npm run stats

import { admin } from './_lib';
import { computeMatches, type PickRow } from '../lib/matching';

async function main() {
  const supabase = admin();

  const { data: rows, error } = await supabase
    .from('picks')
    .select('group_id, rank, token');
  if (error) throw new Error(error.message);

  const couples = computeMatches((rows ?? []) as PickRow[]).length;

  const { count: signedUp } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true });

  const { count: submitters } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .eq('submitted', true);

  console.log('');
  console.log('  ─── Soft Launch ───');
  console.log(`  👤  signed up:             ${signedUp ?? 0}`);
  console.log(`  ✉️   submitted picks:       ${submitters ?? 0}`);
  console.log(`  💞  couples formed:        ${couples}`);
  console.log(`  🧑‍🤝‍🧑  people matched:         ${couples * 2}`);
  if (submitters && submitters > 0) {
    const pct = Math.round(((couples * 2) / submitters) * 100);
    console.log(`  📈  of submitters matched:  ${pct}%`);
  }
  console.log('');
  console.log('  (numbers only — no names, no rolls, no who-matched-whom)');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
