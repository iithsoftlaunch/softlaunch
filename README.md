# Soft Launch — IITH Prom Matcher

> **🔒 Military-Grade Privacy:** This platform is built on a zero-knowledge architecture using the exact same mathematical foundation (X25519 + AES-256-GCM) that powers Signal and is used by the US NSA for Top Secret government communications. Your crushes are mathematically guaranteed to be anonymous.

A mutual-crush matcher for IIT Hyderabad first-year BTech. You secretly pick up
to three people, ranked, and only find out if someone picked you back. Nobody —
including whoever runs this — can learn an unreciprocated pick.

- **Signup:** 17–21 Sep 2026 · **Seal:** 22 Sep · **Pick:** 23 Sep
- **Reveal:** 24 Sep 2026, 00:01 IST · **Prom:** 26 Sep

## Cryptography & Anonymity (The Math)

This app guarantees that an unreciprocated crush remains entirely private. Not even the database administrators or developers can see who you picked unless that person picks you back. 

Here is exactly how the math works under the hood for anyone auditing the source code:

### 1. Client-Side Key Generation (X25519)
When a user logs in for the first time, their browser generates an **X25519 Elliptic Curve keypair**. 
* The **Public Key** is uploaded to the public directory.
* The **Private Key** *never* leaves the device unencrypted. (It is backed up to the database only after being wrapped via AES-GCM using a PBKDF2 derivative of your personal recovery password).

### 2. The Shared Secret (Diffie-Hellman Key Exchange)
If Alice (A) wants to pick Bob (B), Alice's browser locally computes a shared secret using her own private key and Bob's public key: 
`shared_secret = X25519(A_priv, B_pub)`.

If Bob also picks Alice, his browser does the inverse: 
`shared_secret = X25519(B_priv, A_pub)`.

By the mathematical properties of Diffie-Hellman, both browsers independently arrive at the **exact same 32-byte shared secret** without ever communicating.

### 3. The Anonymous Token (HKDF)
Instead of uploading "Alice picked Bob" to the database, Alice's browser derives a cryptographic token from the shared secret:
`token = HKDF-SHA256(shared_secret, "token")`

She uploads this `token` to the database. If Bob picked Alice, he uploads the exact same `token`. On Reveal Night, the server simply looks for duplicate tokens. If it sees a pair, it's a mutual match! 

Because hashing is irreversible, a one-sided token (a crush that wasn't returned) is a mathematical dead-end. The server cannot reverse-engineer the token to figure out whose public keys generated it.

### 4. End-to-End Encrypted Notes (AES-GCM)
The note you send is encrypted using **AES-256-GCM** with a key derived from that same shared secret: `note_key = HKDF-SHA256(shared_secret, "note")`. 
It can only be decrypted by the recipient, and *only* if they also picked you (because they need their private key + your public key to compute the shared secret required to unlock it).

### 5. Decoy Keys (The Seal Step)
If only 500 out of 800 students sign up, outsiders might guess who is participating based on who has a public key. To prevent this, the `seal` script runs before picking starts. It mints fake (decoy) X25519 public keys for every student who didn't register, instantly discarding the private half. In the database, a non-participant is mathematically indistinguishable from an active user.

### 6. The Anonymous Database (Row Level Security)
The `picks` table is entirely decoupled from the users. It deliberately lacks a `user_id` column. When a user submits their 3 picks, they are dumped into the table blindly via a strict Postgres Remote Procedure Call (`submit_picks()`). Once submitted, not even the sender can query their own picks back. An hourly cron job shuffles the physical rows in the database to destroy chronological correlation.


