// ============================================================================
// Mutual — matching (Rule B)
// ----------------------------------------------------------------------------
// Runs at reveal, server-side, over the raw picks table. Knows nothing about
// identities: it sees only group ids (random per submission), ranks, and
// tokens.
//
// A mutual match is a token that two DIFFERENT groups both produced. Everyone
// ends with at most one match. When someone matches more than one person we
// lock the strongest pair first, remove both, and let whoever is left fall
// back down their own list — never pairing anyone outside their own picks.
// ============================================================================

export interface PickRow {
  group_id: string;
  rank: number; // 1..3
  token: string;
}

interface Edge {
  a: string; // group id
  b: string; // group id
  rankA: number; // a's rank of b
  rankB: number; // b's rank of a
  token: string;
  combined: number; // rankA + rankB — lower is stronger
}

/**
 * Returns the set of tokens that become confirmed matches under Rule B.
 * The caller pads this set with random decoy tokens before publishing, so the
 * couple count cannot be read off the reveal file.
 */
export function computeMatches(rows: PickRow[]): string[] {
  // Group rows by token. A mutual token is produced by exactly two distinct
  // groups (two different X25519 shared secrets can't collide on a token).
  const byToken = new Map<string, PickRow[]>();
  for (const r of rows) {
    const list = byToken.get(r.token);
    if (list) list.push(r);
    else byToken.set(r.token, [r]);
  }

  const edges: Edge[] = [];
  for (const [token, list] of byToken) {
    if (list.length < 2) continue; // one-sided pick — never a match
    // Take the two distinct groups. Guard against a group somehow producing the
    // same token twice (shouldn't happen; a self-pick is blocked at submit).
    const distinct = new Map<string, PickRow>();
    for (const r of list) if (!distinct.has(r.group_id)) distinct.set(r.group_id, r);
    if (distinct.size !== 2) continue;
    const [x, y] = [...distinct.values()];
    edges.push({
      a: x.group_id,
      b: y.group_id,
      rankA: x.rank,
      rankB: y.rank,
      token,
      combined: x.rank + y.rank,
    });
  }

  // Rule B: greedily lock the strongest available pair.
  //   Primary sort: combined rank ascending (a #1<->#1 beats a #1<->#2).
  //   Tiebreak: token string, purely for deterministic, reproducible output.
  edges.sort((e1, e2) =>
    e1.combined !== e2.combined
      ? e1.combined - e2.combined
      : e1.token < e2.token
        ? -1
        : 1,
  );

  const used = new Set<string>();
  const matchedTokens: string[] = [];
  for (const e of edges) {
    if (used.has(e.a) || used.has(e.b)) continue; // one of them already matched
    used.add(e.a);
    used.add(e.b);
    matchedTokens.push(e.token);
  }
  return matchedTokens;
}

/**
 * Pads the matched-token set with random decoy tokens so the published reveal
 * file leaks nothing about how many couples formed. Decoys are random 32-byte
 * base64url strings; they can never collide with a real derived token, so no
 * client ever gets a false "you matched".
 */
export function padWithDecoys(
  matchedTokens: string[],
  minTotal = 400,
  jitter = 200,
): string[] {
  const target = Math.max(
    minTotal,
    matchedTokens.length + Math.floor(Math.random() * jitter),
  );
  const out = new Set(matchedTokens);
  while (out.size < target) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    out.add(btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  }
  // Shuffle so real tokens aren't grouped at the front.
  const arr = [...out];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
