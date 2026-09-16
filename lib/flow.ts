// ============================================================================
// Soft Launch — client flow layer
// Ties the crypto module to the Supabase RPCs. Runs in the browser only.
// ============================================================================
'use client';

import { createClient } from '@/lib/supabase/client';
import {
  generateKeyPair,
  publicFromPrivate,
  deriveShared,
  tokenFromShared,
  claimKeyFromShared,
  encryptNote,
  decryptNote,
  wrapPrivateKey,
  unwrapPrivateKey,
  encryptKit,
  decryptKit,
  saveKeyPairLocal,
  loadKeyPairLocal,
  saveKitLocal,
  loadKitLocal,
  toB64url,
  fromB64url,
  type KitEntry,
} from '@/lib/crypto';

const LS_NAME = 'sl.name';

function saveNameLocal(name: string) {
  try {
    localStorage.setItem(LS_NAME, name);
  } catch {}
}
function loadNameLocal(): string {
  try {
    return localStorage.getItem(LS_NAME) ?? '';
  } catch {
    return '';
  }
}

export function getMyName(): string {
  return loadNameLocal();
}

// The caller's own gender, normalized to 'F' | 'M' | null (for gendered copy).
export async function getMyGender(): Promise<'F' | 'M' | null> {
  const supabase = createClient();
  const { data } = await supabase.rpc('my_gender');
  const raw = (typeof data === 'string' ? data : '').trim().toLowerCase();
  if (['f', 'female', 'girl', 'woman', 'w'].includes(raw)) return 'F';
  if (['m', 'male', 'boy', 'man'].includes(raw)) return 'M';
  return null;
}

// Is the logged-in user on the roster (first-year BTech)? Seniors, pass-outs,
// and other departments have valid @iith.ac.in accounts but aren't seeded, so
// they can sign in but can't participate this edition.
export async function isEligible(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const roll = user.email.split('@')[0].toLowerCase();
  const { data } = await supabase
    .from('directory_public')
    .select('roll')
    .eq('roll', roll)
    .maybeSingle();
  return !!data;
}

export interface Status {
  loggedIn: boolean;
  email: string | null;
  registered: boolean;
  submitted: boolean;
  hasLocalKeys: boolean;
  hasLocalKit: boolean;
  sealed: boolean;
}

// Before-seal consent (account-level intent): "if I match, I'm open to being shown
// on the wall / reposted on Instagram." Recorded on the caller's own account, tied
// to no one else. Backed by the set_pre_consent() RPC (see schema.sql).
export async function setPreConsent(
  showSite: boolean,
  showInsta: boolean,
  line: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('set_pre_consent', {
    p_show_site: showSite,
    p_show_insta: showInsta,
    p_line: line,
  });
  if (error) throw new Error(error.message);
}

export async function getStatus(): Promise<Status> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      loggedIn: false,
      email: null,
      registered: false,
      submitted: false,
      hasLocalKeys: false,
      hasLocalKit: false,
      sealed: false,
    };
  }
  const { data: acct } = await supabase
    .from('accounts')
    .select('submitted, wrapped_key, kit_ct')
    .eq('id', user.id)
    .maybeSingle();

  const { count } = await supabase.from('directory_public').select('roll', { count: 'exact', head: true }).is('public_key', null);
  const isSealed = count === 0;

  return {
    loggedIn: true,
    email: user.email ?? null,
    registered: !!acct,
    submitted: !!acct?.submitted,
    hasLocalKeys: !!loadKeyPairLocal(),
    hasLocalKit: !!loadKitLocal(),
    sealed: isSealed,
  };
}

// First-login registration: the name comes from the roster (roll -> name), not
// typed. Make a keypair, keep it local, store the password-wrapped backup and
// the real public key on the server.
export async function registerParticipant(password: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('not logged in');
  const roll = user.email.split('@')[0].toLowerCase();

  const { data: dir } = await supabase
    .from('directory_public')
    .select('display_name')
    .eq('roll', roll)
    .maybeSingle();
  const name = dir?.display_name?.trim();
  if (!name) throw new Error('your roll isn’t on the roster');

  const kp = generateKeyPair();
  saveKeyPairLocal(kp);
  saveNameLocal(name);
  const wrapped = await wrapPrivateKey(kp.privateKey, password);

  const { error } = await supabase.rpc('register', {
    p_display_name: name,
    p_public_key: toB64url(kp.publicKey),
    p_wrapped_key: JSON.stringify(wrapped),
  });
  if (error) throw new Error(error.message);
}

export interface RollHit {
  roll: string;
  displayName: string;
  publicKey: string; // base64url
}

// Typo-check lookup: type a roll, get the name. Returns null if not on roster.
export async function lookupRoll(roll: string): Promise<RollHit | null> {
  const supabase = createClient();
  const clean = roll.trim().toLowerCase().replace(/\s/g, '');
  if (!clean) return null;
  const { data } = await supabase
    .from('directory_public')
    .select('roll, display_name, public_key')
    .eq('roll', clean)
    .maybeSingle();
  if (!data || !data.public_key) return null;
  return { roll: data.roll, displayName: data.display_name, publicKey: data.public_key };
}

export interface PickInput {
  roll: string;
  publicKey: string; // base64url of target's key (real or decoy)
  rank: number; // 1..3
  note: string;
}

// Seal and submit. Builds tokens + encrypted notes locally, uploads only those,
// and stores the encrypted reveal kit for recovery.
export async function submitPicks(picks: PickInput[]): Promise<void> {
  const supabase = createClient();
  const kp = loadKeyPairLocal();
  if (!kp) throw new Error('missing local keys — recover your account first');
  const myName = loadNameLocal() || 'someone';

  const picksPayload: Array<{
    rank: number;
    token: string;
    note_ct: string;
    note_iv: string;
  }> = [];
  const kit: KitEntry[] = [];

  for (const p of picks) {
    const shared = deriveShared(kp.privateKey, fromB64url(p.publicKey));
    const token = tokenFromShared(shared);
    const sealed = await encryptNote(shared, { name: myName, text: p.note });
    picksPayload.push({
      rank: p.rank,
      token,
      note_ct: sealed.note_ct,
      note_iv: sealed.note_iv,
    });
    kit.push({ token, shared: toB64url(shared) });
  }

  const kitCt = await encryptKit(kp.privateKey, kit);
  const { error } = await supabase.rpc('submit_picks', {
    p_picks: picksPayload,
    p_kit_ct: kitCt,
  });
  if (error) throw new Error(error.message);
  saveKitLocal(kit);
}

// Recover a lost device from the password: unwrap the private key, decrypt the
// reveal kit, and restore both to local storage.
export async function recoverFromPassword(password: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('log in first');
  const { data: acct } = await supabase
    .from('accounts')
    .select('wrapped_key, kit_ct')
    .eq('id', user.id)
    .maybeSingle();
  if (!acct?.wrapped_key) throw new Error('no backup found for this account');

  const priv = await unwrapPrivateKey(JSON.parse(acct.wrapped_key), password);
  const pub = publicFromPrivate(priv);
  saveKeyPairLocal({ privateKey: priv, publicKey: pub });

  const roll = user.email!.split('@')[0].toLowerCase();
  const { data: dir } = await supabase.from('directory_public').select('display_name').eq('roll', roll).maybeSingle();
  if (dir?.display_name) saveNameLocal(dir.display_name.trim());

  if (acct.kit_ct) {
    const kit = await decryptKit(priv, acct.kit_ct);
    saveKitLocal(kit);
  }
}

export type RevealResult =
  | { matched: true; name: string; text: string; token: string }
  | { matched: false };

interface RevealEntry {
  token: string;
  notes: Array<{ note_ct: string; note_iv: string }>;
}

// Check the static reveal file against the local kit. Fully client-side.
export async function getRevealResult(): Promise<RevealResult> {
  const kit = loadKitLocal();
  if (!kit) throw new Error('no reveal kit on this device — recover your account');
  const myName = loadNameLocal();

  // The reveal is a single static JSON file on the CDN: matched tokens padded
  // with decoys. Fetched and checked entirely client-side.
  const url = process.env.NEXT_PUBLIC_REVEAL_URL || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reveal/results.json`;
  if (!url || url.includes('undefined')) throw new Error('results are not published yet');
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('results are not published yet');
  const entries = (await res.json()) as RevealEntry[];

  const map = new Map<string, RevealEntry['notes']>();
  for (const e of entries) map.set(e.token, e.notes);

  for (const entry of kit) {
    const notes = map.get(entry.token);
    if (!notes) continue; // this pick was not mutual
    const shared = fromB64url(entry.shared);
    for (const n of notes) {
      const dec = await decryptNote(shared, n);
      if (dec && dec.name !== myName) {
        return { matched: true, name: dec.name, text: dec.text, token: entry.token };
      }
    }
  }
  return { matched: false };
}

export interface WallPair {
  name_a: string;
  line_a: string | null; // after-result message
  preline_a: string | null; // before-seal message
  name_b: string;
  line_b: string | null;
  preline_b: string | null;
}

export async function getWall(): Promise<WallPair[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_wall');
  if (error) throw new Error(error.message);
  return (data ?? []) as WallPair[];
}

export async function claimWall(
  token: string,
  name: string,
  line: string,
  showSite: boolean,
  showInsta: boolean,
): Promise<void> {
  const supabase = createClient();
  // Prove we're actually in this pair: derive the claim key from the shared
  // secret in our local kit. Only the two partners can produce it, and it's
  // never published, so an outsider who knows the (public, post-reveal) token
  // can neither forge a claim nor probe which tokens are real.
  const kit = loadKitLocal();
  const entry = kit?.find((e) => e.token === token);
  if (!entry) throw new Error('missing reveal kit — recover your account first');
  const claimKey = claimKeyFromShared(fromB64url(entry.shared));

  const { error } = await supabase.rpc('claim_wall', {
    p_token: token,
    p_name: name,
    p_line: line,
    p_show_site: showSite,
    p_show_insta: showInsta,
    p_claim_key: claimKey,
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}
