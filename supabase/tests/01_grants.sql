-- Supabase grants these to `authenticated` by default. Replicated after the
-- migrations so the tests exercise RLS rather than a plain permission error —
-- without them every assertion would "pass" for the wrong reason.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
