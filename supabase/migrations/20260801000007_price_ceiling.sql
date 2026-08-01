-- Two loose ends from review.

-- ---------------------------------------------------------------------------
-- price gets a real ceiling
-- ---------------------------------------------------------------------------
--
-- The form mirrors every other limit from a named CHECK that the regression
-- suite asserts, so a mismatch gets caught. `price` was the exception: it
-- mirrored the implicit int4 bound, had no CHECK to point at, and nothing could
-- assert it — and it was the one that was wrong. The client cap was set to
-- 10,000,000,000 with a comment claiming that was "comfortably inside int4",
-- which it is not: int4 tops out at 2,147,483,647. Anything between the two
-- passed the form and died at INSERT with "integer out of range" — after every
-- photo had already uploaded, which is exactly the failure the cap existed to
-- prevent.
--
-- A named constraint fixes the class of problem rather than the instance: now
-- the limit has somewhere to live, the suite can assert it, and the client
-- mirrors something checkable. One billion won is far past any garment and far
-- inside int4.

alter table public.items
  drop constraint if exists items_price_max;

alter table public.items
  add constraint items_price_max check (price is null or price <= 1000000000);

-- ---------------------------------------------------------------------------
-- The last function anon could execute
-- ---------------------------------------------------------------------------
--
-- 006 revoked anon from the two RPCs by name, leaving `set_updated_at` with the
-- `anon=X` that Supabase's default privileges gave it. Harmless in practice —
-- PostgREST does not expose trigger-returning functions, and calling it directly
-- fails with "can only be called as a trigger" — but 006's whole premise was
-- that the stated intent and the actual state should agree.
--
-- Revoking is safe: Postgres does not check EXECUTE when firing a trigger, only
-- when the trigger is created. Verified on 17 — the updated_at trigger still
-- fires for a role with no EXECUTE on the function.

revoke all on function public.set_updated_at() from public, anon, authenticated;
