-- Migration 005 claimed to make the ordering RPCs "signed-in users only". It did
-- not, and the test written to prove it could not see the difference.
--
-- Supabase bootstraps every project with:
--
--   alter default privileges in schema public
--     grant all on functions to postgres, anon, authenticated, service_role;
--
-- so a function created in `public` is born with an explicit `anon=X` entry
-- alongside the PUBLIC default. `revoke ... from public` removes only the
-- pseudo-role entry; the explicit grant to anon survives it. Confirmed against
-- the live project — `supabase db dump` still emits
-- `GRANT ALL ON FUNCTION public.reorder_item_images(...) TO "anon";`.
--
-- No security consequence: both functions are SECURITY INVOKER and every row is
-- behind an RLS policy scoped `to authenticated`, so an anonymous caller reaches
-- nothing. The problem is that the stated intent and the actual state disagreed,
-- and the assertions added in 005 checked for the absence of the PUBLIC entry
-- rather than the absence of anon.
--
-- service_role keeps EXECUTE deliberately: it is the server-side key, it already
-- bypasses RLS, and withholding one function from it would be arbitrary.

revoke all on function public.reorder_item_images(uuid, uuid[]) from public, anon;
revoke all on function public.delete_item_image(uuid) from public, anon;

grant execute on function public.reorder_item_images(uuid, uuid[])
  to authenticated, service_role;
grant execute on function public.delete_item_image(uuid)
  to authenticated, service_role;
