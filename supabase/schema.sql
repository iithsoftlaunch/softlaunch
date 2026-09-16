-- ============================================================================
-- Soft Launch — Database Architecture & Row Level Security
-- ============================================================================
--
-- CORE PRIVACY GUARANTEE:
--   * The `picks` table explicitly lacks any column linking a row to a user.
--   * It is impossible to SELECT from the table to retrieve an author link.
--   * An unreciprocated crush is cryptographically unrecoverable.
--   * The schema is designed so that the user-to-pick link is never stored.
--
-- Two RPCs (SECURITY DEFINER) handle the insertion and ensure that the 
-- relationship between a user and their picks is deliberately NOT persisted.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- directory : the full first-year BTech roster. Everyone is pickable.
--   public_key is NULL until the roll registers (real key) or until the
--   the seal step mints a decoy for it. Because decoys are indistinguishable from
--   real keys, public_key never reveals who actually signed up.
--   is_registered is admin-only and MUST NOT be exposed to clients.
-- ---------------------------------------------------------------------------
create table if not exists directory (
  roll          text primary key,
  display_name  text not null,
  public_key    text,                       -- X25519 pubkey (real or decoy), base64url
  gender        text,                        -- from the roster, if explicitly available (F/M/…)
  is_registered boolean not null default false
);

-- my_gender(): returns ONLY the caller's own gender (for gendered copy). Never
-- exposes anyone else's — directory_public does not include gender.
create or replace function my_gender()
returns text language plpgsql security definer set search_path = public as $$
begin
  return (select gender from directory where roll = roll_from_jwt());
exception when others then return null;
end; $$;
grant execute on function my_gender() to authenticated;

-- Client-facing view: exactly the three fields needed to look someone up and
-- pick them. This is a SECURITY DEFINER view (the default) owned by the admin
-- role, so it can read the base table while clients cannot — that's what hides
-- is_registered. Clients are granted SELECT on this view only.
create or replace view directory_public as
  select roll, display_name, public_key
  from directory;

-- ---------------------------------------------------------------------------
-- accounts : one row per registered user. Tracks ONLY that they submitted,
--   as a boolean. Deliberately no submitted_at — a timestamp here could be
--   joined against anything else to leak counts/ordering.
-- ---------------------------------------------------------------------------
create table if not exists accounts (
  id          uuid primary key references auth.users(id) on delete cascade,
  roll        text unique not null references directory(roll),
  wrapped_key text,                          -- password-wrapped private key backup (opaque)
  kit_ct      text,                          -- reveal kit encrypted under HKDF(priv) (opaque)
  submitted   boolean not null default false,
  -- before-seal consent (the user's own intent, if they end up matching):
  pre_show_site  boolean not null default false,
  pre_show_insta boolean not null default false,
  pre_line       text check (length(pre_line) <= 500)                       -- the message they wrote at seal time
);

-- ---------------------------------------------------------------------------
-- picks : the tokens. NO user column. group_id ties one person's up-to-3 rows
--   together (needed for the matching rule) but points at nobody. NO created_at
--   (ordering could correlate rows back to submitters; an hourly reshuffle job
--   further destroys physical row order).
-- ---------------------------------------------------------------------------
create table if not exists picks (
  id       uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  rank     smallint not null check (rank between 1 and 3),
  token    text not null check (length(token) <= 100),
  note_ct  text check (length(note_ct) <= 10000),                             -- AES-GCM ciphertext of the note, base64url
  note_iv  text check (length(note_iv) <= 100)                              -- 12-byte GCM nonce, base64url
);
create index if not exists picks_token_idx on picks(token);
create index if not exists picks_group_idx on picks(group_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table directory enable row level security;
alter table accounts  enable row level security;
alter table picks     enable row level security;

-- directory: no direct client access to the base table (hides is_registered).
--   Clients read the SECURITY DEFINER view instead; admin seeds via the service
--   role. RLS stays enabled with NO select policy for clients, so a direct
--   `select from directory` is denied — only the view (owned by admin) reads it.
grant select on directory_public to authenticated;
revoke all on directory from authenticated, anon;

-- accounts: a user may READ only their own row (to see whether they've
--   submitted and to fetch their own recovery blobs). All writes go through the
--   SECURITY DEFINER RPCs (register / submit_picks), so no client update policy
--   exists — the client can never flip `submitted` or edit another account.
create policy accounts_self_select on accounts
  for select to authenticated
  using (id = auth.uid());

-- picks: NOBODY gets direct access. No select/insert/update/delete policies
--   are created, so with RLS enabled all client access is denied. Only the
--   SECURITY DEFINER functions below touch this table.
-- (intentionally no policies)

-- ---------------------------------------------------------------------------
-- roll_from_jwt() : derive roll from the authenticated email localpart and
--   enforce the @iith.ac.in domain. Belt-and-suspenders alongside Supabase
--   auth's own domain gating.
-- ---------------------------------------------------------------------------
create or replace function roll_from_jwt()
returns text
language plpgsql
stable
as $$
declare
  email text := lower(auth.jwt() ->> 'email');
begin
  if email is null or split_part(email, '@', 2) <> 'iith.ac.in' then
    raise exception 'not an iith.ac.in account';
  end if;
  return split_part(email, '@', 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- register(display_name, public_key, wrapped_key)
--   First-login registration. Confirms the roster name (or overrides it),
--   stores the real public key, and marks the roll registered. Idempotent
--   until the user has submitted.
-- ---------------------------------------------------------------------------
create or replace function register(
  p_display_name text,
  p_public_key   text,
  p_wrapped_key  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roll text := roll_from_jwt();
  v_dir directory%rowtype;
begin
  -- The roll must exist in the roster (first-year BTech only).
  select * into v_dir from directory where roll = v_roll for update;
  if not found then
    raise exception 'roll % is not on the roster', v_roll;
  end if;

  if v_dir.public_key is not null and not v_dir.is_registered then
    raise exception 'Signup phase has ended and directory is sealed.';
  end if;

  insert into accounts (id, roll, wrapped_key)
    values (auth.uid(), v_roll, p_wrapped_key)
  on conflict (id) do update
    set wrapped_key = excluded.wrapped_key
    where accounts.submitted = false;

  update directory
    set display_name  = coalesce(nullif(trim(p_display_name), ''), display_name),
        public_key    = p_public_key,
        is_registered = true
    where roll = v_roll;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_picks(picks jsonb)
--   The ONLY writer of the picks table. Accepts an array of
--   {rank, token, note_ct, note_iv}. Generates a fresh random group_id and
--   inserts the rows WITHOUT ever persisting the auth.uid()->group_id link.
--   Enforces submit-once and max 3 picks. Atomic.
-- ---------------------------------------------------------------------------
create or replace function submit_picks(p_picks jsonb, p_kit_ct text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid := gen_random_uuid();
  v_count int  := coalesce(jsonb_array_length(p_picks), 0);
  v_item  jsonb;
  v_rank  smallint;
  v_account accounts%rowtype;
begin
  -- 0 picks is allowed ("here for the vibes"); cap at 3.
  if v_count > 3 then
    raise exception 'at most 3 picks allowed';
  end if;

  if (select count(distinct v->>'token') from jsonb_array_elements(p_picks) v) <> v_count then
    raise exception 'duplicate tokens not allowed';
  end if;
  if (select count(distinct (v->>'rank')::smallint) from jsonb_array_elements(p_picks) v) <> v_count then
    raise exception 'duplicate ranks not allowed';
  end if;

  -- submit-once, checked and set on the caller's own account row
  select * into v_account from accounts where id = auth.uid() for update;
  if not found then
    raise exception 'register before submitting';
  end if;
  if v_account.submitted then
    raise exception 'already submitted';
  end if;

  for v_item in select * from jsonb_array_elements(p_picks)
  loop
    v_rank := (v_item ->> 'rank')::smallint;
    if v_rank < 1 or v_rank > 3 then
      raise exception 'invalid rank';
    end if;
    insert into picks (group_id, rank, token, note_ct, note_iv)
      values (
        v_group,
        v_rank,
        v_item ->> 'token',
        v_item ->> 'note_ct',
        v_item ->> 'note_iv'
      );
  end loop;

  update accounts
    set submitted = true,
        kit_ct    = p_kit_ct
    where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- reshuffle_picks()
--   Called hourly by cron. Rewrites the picks table in random physical order
--   so insertion order cannot correlate rows back to submitters.
-- ---------------------------------------------------------------------------
create or replace function reshuffle_picks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  lock table picks in access exclusive mode;
  create temporary table _picks_shuffled on commit drop as
    select * from picks order by random();
  delete from picks;
  insert into picks select * from _picks_shuffled;
end;
$$;

-- Expose the RPCs to logged-in users; keep maintenance jobs to the service role.
-- ---------------------------------------------------------------------------
-- set_pre_consent(show_site, show_insta)
--   Records the caller's OWN before-seal consent intent on their account. Tied
--   to nobody else; safe to call anytime before results. The binding, pair-based
--   consent is still collected post-reveal via claim_wall().
-- ---------------------------------------------------------------------------
create or replace function set_pre_consent(p_show_site boolean, p_show_insta boolean, p_line text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update accounts
    set pre_show_site  = coalesce(p_show_site, false),
        pre_show_insta = coalesce(p_show_insta, false),
        pre_line       = nullif(trim(p_line), '')
    where id = auth.uid();
end;
$$;

grant execute on function register(text, text, text)      to authenticated;
grant execute on function submit_picks(jsonb, text)       to authenticated;
grant execute on function set_pre_consent(boolean, boolean, text) to authenticated;
revoke all on function reshuffle_picks()                  from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Couples wall. Post-reveal, opt-in. Knowing the token proves you are one of
-- the pair (only the two members can derive it). Two distinct claimants for a
-- token, both consenting to the site, means the pair appears.
-- ---------------------------------------------------------------------------
create table if not exists wall_claims (
  token      text not null,
  claimant   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  line       text,
  show_site  boolean not null default true,
  show_insta boolean not null default false,
  claim_key  text,                            -- proof of pair membership (see claim_wall)
  primary key (token, claimant)
);
alter table wall_claims enable row level security;

-- A user manages only their own claim row; nobody reads the raw table (the
-- public wall comes from get_wall() below, which returns only consented pairs).
create policy wall_self_all on wall_claims
  for all to authenticated
  using (claimant = auth.uid())
  with check (claimant = auth.uid());

-- claim_wall: record this user's consent to appear on the wall for a match.
--   Membership is proven by p_claim_key (HKDF of the pair's shared secret; only
--   the two partners can derive it, and it is NEVER published in the reveal file).
--   There is deliberately NO "is this token matched?" check: post-reveal the real
--   tokens are public, so success-vs-error would be an oracle that defeats the
--   decoy padding and lets outsiders inject fake pairings. Instead, get_wall only
--   ever surfaces a pair when BOTH partners present the SAME claim_key and both
--   consent — so junk or forged claims simply never pair with anyone.
create or replace function claim_wall(
  p_token      text,
  p_name       text,
  p_line       text,
  p_show_site  boolean,
  p_show_insta boolean,
  p_claim_key  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into wall_claims (token, claimant, name, line, show_site, show_insta, claim_key)
    values (p_token, auth.uid(), p_name, nullif(trim(p_line), ''), p_show_site, p_show_insta, p_claim_key)
  on conflict (token, claimant) do update
    set name = excluded.name,
        line = excluded.line,
        show_site = excluded.show_site,
        show_insta = excluded.show_insta,
        claim_key = excluded.claim_key;
end;
$$;

-- get_wall: consented pairs only (both sides claimed with show_site = true).
-- Pairs are grouped by claim_key (the shared-secret proof), NOT by the public
-- token, so only genuine partners are ever matched together. Returns each pair
-- with BOTH names and BOTH of each person's messages: line = the after-result
-- message, preline = the before-seal message.
create or replace function get_wall()
returns table (
  name_a text, line_a text, preline_a text,
  name_b text, line_b text, preline_b text
)
language sql
security definer
set search_path = public
as $$
  with claimed as (
    select w.claim_key, w.name, w.line, a.pre_line,
           row_number() over (partition by w.claim_key order by w.claimant) as rn,
           count(*)      over (partition by w.claim_key) as n,
           w.claimant,
           bool_and(w.show_site) over (partition by w.claim_key) as both_site
    from wall_claims w
    left join accounts a on a.id = w.claimant
    where w.claim_key is not null
  )
  select x.name, x.line, x.pre_line, y.name, y.line, y.pre_line
  from claimed x
  join claimed y on x.claim_key = y.claim_key and x.rn = 1 and y.rn = 2
  where x.n = 2 and x.both_site and x.claimant <> y.claimant;
$$;

grant execute on function claim_wall(text, text, text, boolean, boolean, text) to authenticated;
grant execute on function get_wall() to authenticated, anon;

-- ============================================================================
-- SYSTEM LIFECYCLE:
--   * Seed: The directory is seeded securely prior to launch.
--   * Seal: Before picking opens, the directory is cryptographically sealed. 
--     Every unregistered user receives a mathematically indistinguishable decoy 
--     public key to perfectly mask who actually registered.
--   * Reveal: Matches are computed securely, padded with thousands of decoys 
--     to prevent statistical analysis, and exported as a static JSON file.
--   * Wipe: The database is wiped 3 days after reveal to ensure ephemeral privacy.
-- ============================================================================
-- A. Revoke the implicit write grants on the view
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON directory_public FROM anon, authenticated, public;

-- Also clean up leftover grants on tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON accounts FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON picks FROM anon, authenticated, public;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON wall_claims FROM anon, authenticated, public;

-- Ensure SELECT is granted properly
GRANT SELECT ON directory_public TO authenticated;

-- B. Fix submit_picks (Add FOR UPDATE and STRICT length limits)
CREATE OR REPLACE FUNCTION submit_picks(p_picks jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_account accounts%rowtype;
  v_group uuid := gen_random_uuid();
  v_pick jsonb;
  v_count int := jsonb_array_length(p_picks);
BEGIN
  if v_count > 3 then
    raise exception 'Maximum 3 picks allowed.';
  end if;
  
  -- Prevent duplicates in the payload
  if (select count(distinct p->>'token') from jsonb_array_elements(p_picks) as p) < v_count then
    raise exception 'Duplicate tokens not allowed.';
  end if;
  if (select count(distinct p->>'rank') from jsonb_array_elements(p_picks) as p) < v_count then
    raise exception 'Duplicate ranks not allowed.';
  end if;

  select * into v_account from accounts where id = auth.uid() for update;
  if not found then
    raise exception 'Account not found.';
  end if;
  if v_account.submitted then
    raise exception 'Picks already submitted.';
  end if;

  for v_pick in select * from jsonb_array_elements(p_picks) loop
    -- Enforce strict lengths to prevent padding leaks
    if length(v_pick->>'token') > 100 or length(v_pick->>'note_ct') > 800 or length(v_pick->>'note_iv') > 30 then
      raise exception 'Payload size exceeded limits.';
    end if;

    insert into picks (group_id, rank, token, note_ct, note_iv)
    values (
      v_group,
      (v_pick->>'rank')::int,
      v_pick->>'token',
      v_pick->>'note_ct',
      v_pick->>'note_iv'
    );
  end loop;

  update accounts set submitted = true where id = auth.uid();
END;
$$;

-- C. Fix reshuffle_picks (Role check + Lock)
CREATE OR REPLACE FUNCTION reshuffle_picks()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  if current_setting('request.jwt.claims', true)::jsonb->>'role' <> 'service_role' then
    raise exception 'Unauthorized';
  end if;
  lock table picks in access exclusive mode;
  create temporary table _picks_shuffled on commit drop as select * from picks order by random();
  delete from picks;
  insert into picks select * from _picks_shuffled;
END;
$$;
REVOKE ALL ON FUNCTION reshuffle_picks() FROM anon, authenticated, public;

-- Wall Forgery fix (Remove display_name, check token)
CREATE OR REPLACE FUNCTION claim_wall(
  p_claim_key text,
  p_token text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  if not exists (select 1 from picks where token = p_token) then
    raise exception 'Invalid token: You cannot post a fake crush to the wall.';
  end if;
  insert into wall_claims (claimant, claim_key, token)
  values (auth.uid(), p_claim_key, p_token)
  on conflict (claimant) do update
  set claim_key = excluded.claim_key,
      token = excluded.token;
END;
$$;

-- Enforce search_path on all functions for security
ALTER FUNCTION my_gender() SET search_path = public;
ALTER FUNCTION register(text, text, text) SET search_path = public;
ALTER FUNCTION enforce_iith_email() SET search_path = public;
DROP FUNCTION IF EXISTS claim_wall(text, text);
DROP FUNCTION IF EXISTS claim_wall(text, text, text);

CREATE OR REPLACE FUNCTION claim_wall(
  p_token      text,
  p_name       text,
  p_line       text,
  p_show_site  boolean,
  p_show_insta boolean,
  p_claim_key  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security Check: Validate token actually exists in the database
  if not exists (select 1 from picks where token = p_token) then
    raise exception 'Invalid token: You cannot post a fake crush to the wall.';
  end if;

  insert into wall_claims (token, claimant, name, line, show_site, show_insta, claim_key)
    values (p_token, auth.uid(), p_name, nullif(trim(p_line), ''), p_show_site, p_show_insta, p_claim_key)
  on conflict (token, claimant) do update
    set name = excluded.name,
        line = excluded.line,
        show_site = excluded.show_site,
        show_insta = excluded.show_insta,
        claim_key = excluded.claim_key;
END;
$$;
-- 1. Secure system_config
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON system_config FROM anon, authenticated, public;

-- 2. Drop the incorrect 1-arg submit_picks
DROP FUNCTION IF EXISTS submit_picks(jsonb);

-- 3. Replace the correct 2-arg submit_picks with locks and limits
CREATE OR REPLACE FUNCTION submit_picks(p_picks jsonb, p_kit_ct text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_account accounts%rowtype;
  v_group uuid := gen_random_uuid();
  v_pick jsonb;
  v_count int := jsonb_array_length(p_picks);
BEGIN
  if v_count > 3 then raise exception 'Maximum 3 picks allowed.'; end if;
  
  -- Compare ranks as integers to prevent '1' vs '1.0' bypass
  if (select count(distinct p->>'token') from jsonb_array_elements(p_picks) as p) < v_count then
    raise exception 'Duplicate tokens not allowed.';
  end if;
  if (select count(distinct (p->>'rank')::int) from jsonb_array_elements(p_picks) as p) < v_count then
    raise exception 'Duplicate ranks not allowed.';
  end if;

  select * into v_account from accounts where id = auth.uid() for update;
  if not found then raise exception 'Account not found.'; end if;
  if v_account.submitted then raise exception 'Picks already submitted.'; end if;

  for v_pick in select * from jsonb_array_elements(p_picks) loop
    if length(v_pick->>'token') > 100 or length(v_pick->>'note_ct') > 800 or length(v_pick->>'note_iv') > 30 then
      raise exception 'Payload size exceeded limits.';
    end if;

    insert into picks (group_id, rank, token, note_ct, note_iv)
    values (v_group, (v_pick->>'rank')::int, v_pick->>'token', v_pick->>'note_ct', v_pick->>'note_iv');
  end loop;

  update accounts 
    set submitted = true,
        recovery_kit_ct = p_kit_ct
    where id = auth.uid();
END;
$$;

-- 4. Fix claim_wall Oracle leak by removing the token verification
CREATE OR REPLACE FUNCTION claim_wall(
  p_token      text,
  p_name       text,
  p_line       text,
  p_show_site  boolean,
  p_show_insta boolean,
  p_claim_key  text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- We intentionally DO NOT verify if the token exists in picks.
  -- Verifying it creates an Oracle leak where attackers can test decoy tokens from results.json.
  -- Forgery is handled by social moderation, not cryptographic failure.
  insert into wall_claims (token, claimant, name, line, show_site, show_insta, claim_key)
    values (p_token, auth.uid(), p_name, nullif(trim(p_line), ''), p_show_site, p_show_insta, p_claim_key)
  on conflict (token, claimant) do update
    set name = excluded.name,
        line = excluded.line,
        show_site = excluded.show_site,
        show_insta = excluded.show_insta,
        claim_key = excluded.claim_key;
END;
$$;

-- 5. Pin roll_from_jwt search_path
ALTER FUNCTION roll_from_jwt() SET search_path = public;
