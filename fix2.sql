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
