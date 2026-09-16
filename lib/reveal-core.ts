// ============================================================================
// Soft Launch — reveal builder (server-side)
// Turns the raw picks rows into the static reveal file the clients download.
// Format: [{ token, notes: [{ note_ct, note_iv }, ...] }]. Only matched tokens
// carry real notes; the set is padded with decoy tokens so the couple count
// can't be read off the file. Notes are already encrypted, so publishing them
// is safe — only the two people in a pair can decrypt.
// ============================================================================

import { computeMatches, type PickRow } from './matching';

export interface RevealNote {
  note_ct: string;
  note_iv: string;
}
export interface RevealEntry {
  token: string;
  notes: RevealNote[];
}

export interface RawPick extends PickRow {
  note_ct: string | null;
  note_iv: string | null;
}

function randB64url(bytes: number): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildReveal(
  rows: RawPick[],
  opts: { minTotal?: number; jitter?: number } = {},
): RevealEntry[] {
  const minTotal = opts.minTotal ?? 400;
  const jitter = opts.jitter ?? 200;

  const matched = new Set(
    computeMatches(rows.map((r) => ({ group_id: r.group_id, rank: r.rank, token: r.token }))),
  );

  const notesByToken = new Map<string, RevealNote[]>();
  for (const r of rows) {
    if (!matched.has(r.token)) continue;
    const arr = notesByToken.get(r.token) ?? [];
    arr.push({ note_ct: r.note_ct ?? '', note_iv: r.note_iv ?? '' });
    notesByToken.set(r.token, arr);
  }

  const entries: RevealEntry[] = [];
  for (const [token, notes] of notesByToken) entries.push({ token, notes });

  // pad with decoy entries (random token + random-looking notes)
  // Fix: Static Bucketing to prevent count leakage
  // We force the file size to always round up to the nearest 1000 entries.
  // E.g. 50 matches -> 1000 file size. 600 matches -> 1000 file size. 1200 matches -> 2000 file size.
  const bucketSize = 1000;
  const target = Math.ceil(Math.max(1, entries.length) / bucketSize) * bucketSize;
  while (entries.length < target) {
    entries.push({
      token: randB64url(32),
      notes: [
        { note_ct: randB64url(528), note_iv: randB64url(12) },
        { note_ct: randB64url(528), note_iv: randB64url(12) },
      ],
    });
  }

  // shuffle so real entries aren't grouped
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return entries;
}
