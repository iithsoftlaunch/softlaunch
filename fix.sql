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
