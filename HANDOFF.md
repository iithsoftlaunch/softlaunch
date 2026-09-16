# Soft Launch — run it on your machine

Hey! This is the whole website. You can run it locally to click through and check
everything. It connects to our shared cloud database, so there's **nothing to
install database-wise** — no local database, no Postgres, nothing.

## What you need (~5 min)

1. **Node.js** (version 20 or newer). Get it from https://nodejs.org (the "LTS"
   button). To check it's there, open Terminal and run: `node -v`

2. **This code.** Unzip the folder somewhere.

3. **Two keys** (ask me for these — they're safe to share, they're the public
   ones). Create a file named `.env.local` in the project folder with:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<the URL I send you>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key I send you>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_PICK_ANYTIME=true
   ```

   That last line (`PICK_ANYTIME=true`) turns on **test mode** so you can walk the
   whole flow any day, not just on the real dates. We remove it for the real launch.

## Run it

In Terminal, inside the project folder:

```
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser.

## Good to know

- We share the **same cloud database**, so anything you do (sign up, pick, seal)
  writes to the real test data. That's fine — there's a pink **"reset & pick
  again"** button (bottom-right) to start over, and I can wipe everything anytime.
- To see the reveal animations without a full run, open
  `http://localhost:3000/reveal?preview=match` and `?preview=nomatch`.
- You do **not** have the secret service key or the student list, and you don't
  need them just to check the site. Those stay on the main machine.
- Log in needs an `@iith.ac.in` Google account (the same login the real site uses).

## If something breaks

Tell me what you saw and on which screen. Everything is fixable — the code is ours
and we can patch and redeploy anytime.
