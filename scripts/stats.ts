// Private admin stats. Prints ONLY aggregate numbers — how many couples formed,
// how many people that is, and how many submitted. No names, no rolls, no who.
// This is the one aggregate the design lets an admin see, and it's computed the
// same way the reveal is.
//
//   npm run stats

import { admin } from './_lib';
import { computeMatches, type PickRow } from '../lib/matching';

async function fetchAllPicks(supabase: ReturnType<typeof admin>): Promise<PickRow[]> {
  const all: PickRow[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('picks')
      .select('group_id, rank, token')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as PickRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function main() {
  const supabase = admin();

  const rows = await fetchAllPicks(supabase);
  const couples = computeMatches(rows).length;

  const { count: signedUp } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true });

  const { count: submitters } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .eq('submitted', true);

  console.log(`Sign-ups: ${signedUp ?? 0}`);
  console.log(`Picks submitted: ${submitters ?? 0}`);
  console.log(`Matched picks: ${couples}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
