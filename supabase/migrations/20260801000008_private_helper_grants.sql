-- Corrects a conclusion from 005 and puts both function groups behind the same
-- rule.
--
-- 005 found that revoking EXECUTE on a CHECK helper made every INSERT fail with
-- "permission denied for function", and concluded that EXECUTE could not be
-- taken away. That was too broad: the test revoked from PUBLIC without granting
-- to the role doing the inserting. Granting explicitly works — verified on 17,
-- with `anon` unable to execute the helpers and the constraints still firing.
--
-- The version this replaces relied on `anon` lacking USAGE on the schema. That
-- does keep direct SQL from resolving the name, but the reasoning attached to it
-- was wrong in two ways:
--
--   * USAGE is not what makes CHECK evaluation work. Constraint expressions
--     store the function's OID and are checked against EXECUTE alone; there is
--     no name resolution at evaluation time, so revoking USAGE from
--     `authenticated` changes nothing. Verified.
--   * USAGE is not what keeps REST clients out either. PostgREST simply does not
--     introspect `private`.
--
-- So the schema boundary handles exposure, and EXECUTE handles authorisation —
-- the same shape already used for the two public RPCs, instead of two function
-- groups protected by different principles with one of the explanations false.

revoke all on function private.has_unique_elements(text[]) from public, anon;
revoke all on function private.max_element_length(text[]) from public, anon;

grant execute on function private.has_unique_elements(text[])
  to authenticated, service_role;
grant execute on function private.max_element_length(text[])
  to authenticated, service_role;
