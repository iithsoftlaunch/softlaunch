// Seed the directory from the roster CSV.
//   1. Put the roster at data/roster.csv with a header row: roll,name
//   2. npm run seed
//
// Leaves public_key NULL and is_registered false — the seal step fills keys.

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { admin } from './_lib';

interface Row {
  roll: string;
  name: string;
  gender: string | null;
}

async function main() {
  const csv = readFileSync('data/roster.csv', 'utf8');
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const rows: Row[] = records
    .map((r) => ({
      roll: (r.roll ?? r.Roll ?? r.rollno ?? '').toLowerCase().replace(/\s/g, ''),
      name: (r.name ?? r.Name ?? '').trim(),
      gender: ((r.gender ?? r.Gender ?? r.sex ?? r.Sex ?? '').trim() || null),
    }))
    .filter((r) => r.roll && r.name);

  if (rows.length === 0) {
    throw new Error('No rows parsed. Expected columns: roll,name');
  }

  const supabase = admin();
  const CHUNK = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map((r) => ({
      roll: r.roll,
      display_name: r.name,
      gender: r.gender,
    }));
    const { error } = await supabase.from('directory').upsert(batch, { onConflict: 'roll' });
    if (error) throw new Error(error.message);
    done += batch.length;
    console.log(`  upserted ${done}/${rows.length}`);
  }
  console.log(`Done. Seeded ${rows.length} roster entries.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
