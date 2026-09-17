// Manual reveal trigger / safety net. Same work the cron does: compute matches,
// build the padded reveal file, upload it to the `reveal` Storage bucket.
//
//   npm run reveal
//
// Use this if the scheduled midnight cron fails, or to dry-run against test data.

import { admin } from './_lib';
import { buildReveal, type RawPick } from '../lib/reveal-core';

const BUCKET = 'reveal';
const FILE = 'results.json';

async function fetchAllPicks(supabase: ReturnType<typeof admin>): Promise<RawPick[]> {
  const all: RawPick[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('picks')
      .select('group_id, rank, token, note_ct, note_iv')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as RawPick[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function main() {
  const supabase = admin();

  const rows = await fetchAllPicks(supabase);
  const entries = buildReveal(rows);
  console.log(`Built reveal file with ${entries.length} entries (matches + decoys).`);

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(FILE, JSON.stringify(entries), {
      upsert: true,
      contentType: 'application/json',
      cacheControl: '60',
    });
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(FILE);
  console.log('Published. Set NEXT_PUBLIC_REVEAL_URL to:');
  console.log('  ' + pub.publicUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
