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
