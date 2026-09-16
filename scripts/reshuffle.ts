// Hourly job: reshuffle the picks table into random physical order so insertion
// order can't correlate rows back to submitters. Run by a scheduled GitHub
// Action (see .github/workflows/reshuffle.yml).
//   npm run reshuffle
import { admin } from './_lib';

async function main() {
  const supabase = admin();
  const { error } = await supabase.rpc('reshuffle_picks');
  if (error) throw new Error(error.message);
  console.log('Reshuffled picks table.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
