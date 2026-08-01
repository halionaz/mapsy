-- Stand-ins for the Supabase-managed objects the migrations depend on.
--
-- Just enough of auth and storage to exercise the real migrations against a
-- plain Postgres image. `supabase start` gives a more faithful stack, but it
-- needs the CLI and a much heavier container set — this runs anywhere Docker
-- does, which is what makes it usable as a pre-commit check.

-- Roles are cluster-wide, so a second run in the same container finds them.
-- `service_role` is included because migrations grant to it; leaving it out
-- would make them fail here for a reason that does not exist on Supabase.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I', r);
    end if;
  end loop;
end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase reads the subject claim off the request; setting that GUC is how the
-- tests impersonate a user.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text,
  owner     uuid
);

alter table storage.objects enable row level security;

-- Path segments minus the filename, matching Supabase's helper.
create or replace function storage.foldername(name text) returns text[]
language sql immutable
as $$
  select (string_to_array(name, '/'))[
    1 : greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)
  ]
$$;

grant usage on schema public, auth, storage to anon, authenticated;

-- Supabase runs this on every new project, and leaving it out made the harness
-- a *different* database rather than a simpler one: functions created in
-- `public` are born with an explicit `anon=X` grant, which `revoke ... from
-- public` does not remove. Without this line the ACL assertions below pass
-- against a shape that does not exist in production.
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
