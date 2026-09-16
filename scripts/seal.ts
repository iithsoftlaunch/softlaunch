// Seal the directory. Run once, after signup closes and before picking opens.
//
// Every roster roll that never registered is given a decoy public key: a real
// X25519 public key whose private half is generated and immediately thrown
// away. This is what makes being pickable reveal nothing about who actually
// signed up — a decoy is indistinguishable from a genuine key, and picks aimed
// at one simply never match.
//
//   npm run seal

import { x25519 } from '@noble/curves/ed25519';
import { admin } from './_lib';

function decoy(): string {
  const priv = x25519.utils.randomPrivateKey();
  const pub = x25519.getPublicKey(priv);
  // priv goes out of scope here and is never stored — that's the point.
  let bin = '';
  for (const b of pub) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function main() {
  const supabase = admin();

  const { data: pending, error } = await supabase
    .from('directory')
    .select('roll')
    .is('public_key', null);
  if (error) throw new Error(error.message);

  let minted = 0;
  for (const row of pending ?? []) {
    const { error } = await supabase
      .from('directory')
      .update({ public_key: decoy() })
      .eq('roll', row.roll);
    if (error) throw new Error(`decoy ${row.roll}: ${error.message}`);
    minted++;
    if (minted % 200 === 0) console.log(`  minted ${minted} decoys…`);
  }

  console.log(`Done. Minted ${minted} decoys. Directory is sealed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
