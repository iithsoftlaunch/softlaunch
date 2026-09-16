// ============================================================================
// Cat-meme system
// ----------------------------------------------------------------------------
// One file controls everything. Kill switch: set MEMES_ENABLED = false.
//
// Each situation ("context") has its own pool of cat reactions, so the meme
// matches the moment. Selection uses ONLY the situation + Math.random() — never
// picks, names, counts, or anything about any user. Two people on the same path
// can see different cats, and nobody can infer anyone else's choices from them.
//
// Every image is a local, self-hosted file under /public/memes/ — nothing is
// fetched from any external service. To add or swap one, drop the file into
// /public/memes/ and reference it in the matching pool below. An empty pool
// simply shows no cat for that situation.
//
// PRIVACY: stickers are shown by <CatMeme>, which displays each one briefly and
// then hides it, and remembers (per device) that it was shown so it never
// reappears on reload/restart — nobody can reopen the browser later and infer a
// past choice from a lingering sticker.
// ============================================================================

export const MEMES_ENABLED = true;

export type MemeContext =
  | 'curious' // user is picking someone
  | 'one' // picked exactly 1
  | 'two' // picked exactly 2
  | 'judging' // picked 3 (and after sealing 3)
  | 'note' // the "add your number/insta" callout
  | 'shy' // picking page: don't be shy
  | 'realistic' // picking page: pick realistically
  | 'empty' // chose 0 people
  | 'sealed' // picks submitted
  | 'password' // welcome / password setup
  | 'nomatch' // no match at reveal
  | 'match' // mutual match at reveal
  | 'wall' // couples wall page
  | 'pleading' // asking consent for the wall / instagram (AFTER results)
  | 'consent' // before-results consent ask (on the sealed page)
  | 'loading';

export interface MemeSpec {
  kind: 'img' | 'video';
  src: string;
  alt: string;
}

// ADD YOUR OWN CAT STICKERS HERE — nothing else is used.
// Each pool is intentionally EMPTY: no memes are pulled from the internet or
// substituted. Drop the files you provide into /public/memes/ and add them to
// the matching pool, e.g.:
//   nomatch: [ () => ({ kind:'img', src:'/memes/nomatch/laughing-cat.gif', alt:'laughing cat' }) ],
// An empty pool simply shows no cat for that situation.
const img = (src: string): MemeSpec => ({ kind: 'img', src, alt: 'cat' });

const POOLS: Record<MemeContext, Array<() => MemeSpec>> = {
  curious: [],
  one: [() => img('/memes/one.jpg')], // picked exactly 1
  two: [() => img('/memes/two.jpg')], // picked exactly 2
  judging: [() => img('/memes/judging.jpg')], // picked/sealed 3
  note: [() => img('/memes/note.jpg')], // "add your number/insta"
  shy: [() => img('/memes/shy.jpg')], // don't be shy
  realistic: [() => img('/memes/realistic.jpg')], // pick realistically
  empty: [() => img('/memes/vibes.jpg')], // chose 0 — shocked "you picked nobody?!" (sl14)
  sealed: [() => img('/memes/sealed.jpg')], // after sealing
  password: [() => img('/memes/password.jpg')], // welcome / password
  nomatch: [() => img('/memes/nomatch.png'), () => img('/memes/nomatch2.jpg')],
  match: [() => img('/memes/match.gif')], // "yapapa" spinning happy cat
  wall: [() => img('/memes/wall.png')], // couples wall page
  pleading: [() => img('/memes/lovey.jpg')], // AFTER-results wall consent — lovestruck (sl16)
  consent: [() => img('/memes/sealed.jpg')], // BEFORE-seal consent — "leave it to us" (sl4)
  loading: [], // spinning-cat video handled separately on the reveal loading screen
};

export function pickMeme(context: MemeContext): MemeSpec | null {
  if (!MEMES_ENABLED) return null;
  const pool = POOLS[context];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]();
}

// Text captions for the no-match screen (separate from the cat image).
export const NO_MATCH_CAPTIONS = [
  'no match this round — but your secret stayed a secret. iconic behaviour honestly.',
  'the crush remains classified. nobody knows a thing.',
  'not mutual this time, but the mystery? fully intact.',
  'zero receipts, zero regrets. you played it perfectly.',
];
export function randomNoMatchCaption(): string {
  return NO_MATCH_CAPTIONS[Math.floor(Math.random() * NO_MATCH_CAPTIONS.length)];
}
