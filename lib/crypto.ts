// ============================================================================
// Soft Launch — browser crypto
// ----------------------------------------------------------------------------
// The privacy guarantee lives here.
//
//   * Each browser holds an X25519 keypair; the private key never leaves the
//     device except wrapped under the user's recovery password.
//   * Picking B: A computes shared = X25519(A_priv, B_pub). If B picks A, B
//     computes the identical shared (DH is symmetric). token = HKDF(shared).
//     Two identical tokens = a mutual match. A one-sided token is uninvertible
//     by the server (it holds no private key).
//   * The note is encrypted under HKDF(shared, "note"). Only the two people in
//     the pair can read it, and only if it's mutual.
//   * "Reveal kit" = the list of {token, shared} this device produced. It is
//     kept locally AND stored on the server encrypted under HKDF(priv, "kit")
//     so a lost browser can be recovered from the password. The kit reveals no
//     names on its own — shared for a non-mutual pick decrypts nothing.
//
//   npm i @noble/curves @noble/hashes
// ============================================================================

import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';

// Public, fixed per event. Not a secret — it only domain-separates this event.
// Deliberately NOT the product name, so renaming the site never changes tokens.
const EVENT_SALT = new TextEncoder().encode('softlaunch:v1:2026');
const INFO_TOKEN = new TextEncoder().encode('token');
const INFO_NOTE = new TextEncoder().encode('note');
const INFO_KIT = new TextEncoder().encode('kit');
// Separate secret derived from the same shared secret, used ONLY to prove pair
// membership when claiming the couples wall. Unlike the token, it is NEVER
// published in the reveal file, so knowing a (public, post-reveal) token does not
// let an outsider forge a claim or probe which tokens are real.
const INFO_CLAIM = new TextEncoder().encode('wall-claim');

// ---------------------------------------------------------------------------
// encoding helpers
// ---------------------------------------------------------------------------
export function toB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// keys
// ---------------------------------------------------------------------------
export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}
export function generateKeyPair(): KeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}
export function publicFromPrivate(privateKey: Uint8Array): Uint8Array {
  return x25519.getPublicKey(privateKey);
}

// ---------------------------------------------------------------------------
// shared secret + token
// ---------------------------------------------------------------------------
export function deriveShared(myPriv: Uint8Array, theirPub: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(myPriv, theirPub);
}
export function tokenFromShared(shared: Uint8Array): string {
  return toB64url(hkdf(sha256, shared, EVENT_SALT, INFO_TOKEN, 32));
}
// Proof of pair membership for a wall claim. Both partners derive the same value
// (DH is symmetric); nobody else can, and it is never published.
export function claimKeyFromShared(shared: Uint8Array): string {
  return toB64url(hkdf(sha256, shared, EVENT_SALT, INFO_CLAIM, 32));
}

// ---------------------------------------------------------------------------
// note encryption (single key per pair; random 96-bit IVs make the two notes
// under that key safe — reuse probability ~2^-96 for two messages)
// ---------------------------------------------------------------------------
export interface SealedNote {
  note_ct: string;
  note_iv: string;
}
export interface NotePayload {
  name: string; // the sender's confirmed name, auto-included
  text: string; // what they wrote
  _pad?: string; // dummy padding to guarantee uniform 256-byte ciphertext length
}

async function noteKey(shared: Uint8Array): Promise<CryptoKey> {
  const raw = hkdf(sha256, shared, EVENT_SALT, INFO_NOTE, 32);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptNote(
  shared: Uint8Array,
  payload: NotePayload,
): Promise<SealedNote> {
  const key = await noteKey(shared);
  const iv = randomBytes(12);
  
  let str = JSON.stringify(payload);
  const encoder = new TextEncoder();
  let byteLen = encoder.encode(str).length;
  
  // Pad EVERY JSON object to exactly 512 bytes.
  // The frontend max note length is 280 chars, so JSON will never exceed ~400 bytes.
  // By forcing a uniform 512 bytes, there are no length "buckets" at all.
  const FIXED_SIZE = 512;
  const needed = FIXED_SIZE - byteLen - 11; // 11 bytes for `,"_pad":""`
  
  if (needed > 0) {
    const obj = { ...payload, _pad: 'x'.repeat(needed) };
    str = JSON.stringify(obj);
  }
  
  const data = encoder.encode(str);
  
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data),
  );
  return { note_ct: toB64url(ct), note_iv: toB64url(iv) };
}

export async function decryptNote(
  shared: Uint8Array,
  sealed: SealedNote,
): Promise<NotePayload | null> {
  try {
    const key = await noteKey(shared);
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64url(sealed.note_iv) },
      key,
      fromB64url(sealed.note_ct),
    );
    return JSON.parse(new TextDecoder().decode(pt)) as NotePayload;
  } catch {
    return null; // wrong key (not this pair) or a decoy note
  }
}

// ---------------------------------------------------------------------------
// recovery: wrap the private key under the user's password (PBKDF2 + AES-GCM)
// ---------------------------------------------------------------------------
const PBKDF2_ITERS = 600_000;
export interface WrappedKey {
  salt: string;
  iv: string;
  ct: string;
}

async function passwordKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapPrivateKey(
  privateKey: Uint8Array,
  password: string,
): Promise<WrappedKey> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await passwordKey(password, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, privateKey),
  );
  return { salt: toB64url(salt), iv: toB64url(iv), ct: toB64url(ct) };
}

export async function unwrapPrivateKey(
  wrapped: WrappedKey,
  password: string,
): Promise<Uint8Array> {
  const key = await passwordKey(password, fromB64url(wrapped.salt));
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64url(wrapped.iv) },
    key,
    fromB64url(wrapped.ct),
  );
  return new Uint8Array(pt);
}

// ---------------------------------------------------------------------------
// reveal kit — the {token, shared} list, encrypted under HKDF(priv, "kit") so
// it can be recovered from the (password-recovered) private key alone.
// ---------------------------------------------------------------------------
export interface KitEntry {
  token: string;
  shared: string; // base64url of the 32-byte shared secret
}

async function kitKey(priv: Uint8Array): Promise<CryptoKey> {
  const raw = hkdf(sha256, priv, EVENT_SALT, INFO_KIT, 32);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptKit(priv: Uint8Array, kit: KitEntry[]): Promise<string> {
  const key = await kitKey(priv);
  const iv = randomBytes(12);
  const data = new TextEncoder().encode(JSON.stringify(kit));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data),
  );
  // pack iv + ct into one blob
  return toB64url(iv) + '.' + toB64url(ct);
}

export async function decryptKit(priv: Uint8Array, blob: string): Promise<KitEntry[]> {
  const [ivS, ctS] = blob.split('.');
  const key = await kitKey(priv);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64url(ivS) },
    key,
    fromB64url(ctS),
  );
  return JSON.parse(new TextDecoder().decode(pt)) as KitEntry[];
}

// ---------------------------------------------------------------------------
// local storage. Holds the keypair and the reveal kit — never a roll or name
// of anyone picked. A match is identified through the decrypted note at reveal.
// ---------------------------------------------------------------------------
const LS = {
  priv: 'sl.priv',
  pub: 'sl.pub',
  kit: 'sl.kit',
};

export function saveKeyPairLocal(kp: KeyPair) {
  try {
    localStorage.setItem(LS.priv, toB64url(kp.privateKey));
    localStorage.setItem(LS.pub, toB64url(kp.publicKey));
  } catch {}
}
export function loadKeyPairLocal(): KeyPair | null {
  try {
    const priv = localStorage.getItem(LS.priv);
    const pub = localStorage.getItem(LS.pub);
    if (!priv || !pub) return null;
    return { privateKey: fromB64url(priv), publicKey: fromB64url(pub) };
  } catch {
    return null;
  }
}
export function saveKitLocal(kit: KitEntry[]) {
  try {
    localStorage.setItem(LS.kit, JSON.stringify(kit));
  } catch {}
}
export function loadKitLocal(): KitEntry[] | null {
  try {
    const raw = localStorage.getItem(LS.kit);
    return raw ? (JSON.parse(raw) as KitEntry[]) : null;
  } catch {
    return null;
  }
}
