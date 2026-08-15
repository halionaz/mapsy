-- 착용 기록 — one row per (garment, calendar day).
--
-- Read the same way the wardrobe already reads `items`: the whole table comes
-- down and is aggregated in memory (PRD §8.4). That is why there is no
-- `wear_count` column on `items` and no trigger maintaining one — a personal
-- wardrobe worn four garments a day for three years is about 4,400 rows, well
-- inside the ceiling the item fetch already accepts.
--
-- No outfit table either. "What was worn together" is the set of rows sharing a
-- `worn_on`; naming and saving a combination is a separate feature, and this
-- table is what it would be built from rather than something it would replace.

-- ---------------------------------------------------------------------------
-- item_wears
-- ---------------------------------------------------------------------------

create table if not exists public.item_wears (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null,
  user_id    uuid not null,

  -- The wearer's *local* calendar day, sent by the client. Deliberately a date
  -- and deliberately not defaulted from now(): the server clock is UTC, so a
  -- garment picked at 08:00 in Seoul would be filed under the previous day.
  worn_on    date not null,

  created_at timestamptz not null default now(),

  -- Composite, like item_images: user_id has to match the parent item's, so a
  -- wear cannot be recorded against somebody else's garment even if a policy is
  -- later loosened by mistake.
  constraint item_wears_item_fk
    foreign key (item_id, user_id)
    references public.items (id, user_id)
    on delete cascade,

  -- "Wore this today" is a fact, not a tally — recording it twice is the same
  -- fact. This is what makes the toggle idempotent and lets a day be treated as
  -- a set of garments rather than a log to append to.
  constraint item_wears_item_date_key unique (item_id, worn_on)
);

comment on column public.item_wears.worn_on is
  'The wearer''s local calendar day. Sent by the client — never derive it from now().';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- "What did I wear, most recently first" — the full fetch, and the lookup for
-- one day. The unique constraint above already indexes (item_id, worn_on),
-- which is what per-garment aggregation reads, so there is no second index for
-- it here.
create index if not exists item_wears_user_date_idx
  on public.item_wears (user_id, worn_on desc);

-- ---------------------------------------------------------------------------
-- worn_on cannot be in the future
-- ---------------------------------------------------------------------------
--
-- A CHECK cannot say this: `current_date` is STABLE rather than IMMUTABLE and
-- Postgres refuses it in a constraint expression. Hence a trigger.
--
-- The tolerance is a whole day, and it is not slack — it is the timezone. The
-- date is the client's calendar day and the comparison runs on a UTC server,
-- and those two are legitimately a day apart for the first nine hours of every
-- Korean morning. `<= current_date` would reject the ordinary case this feature
-- exists for.
--
-- Worth guarding at all because a future row is unreachable: the app only ever
-- edits 오늘 and 어제, so a row dated next year cannot be removed from any
-- screen, and `최근 입은순` would pin that garment to the top of its section
-- until the date arrives. That is reachable from a wrong device clock and from
-- a client bug — a `Date` that went through UTC on the way here writes a day
-- ahead for half the world.
create or replace function public.reject_future_wear()
returns trigger
language plpgsql
-- Empty search_path, like set_updated_at: this runs through a trigger owned by
-- a privileged role, and leaving the caller's search_path in place would let an
-- unqualified name resolve somewhere unintended.
set search_path = ''
as $$
begin
  if new.worn_on > current_date + 1 then
    raise exception '착용 날짜가 미래예요. 기기의 날짜 설정을 확인해주세요.'
      using errcode = 'data_exception';
  end if;
  return new;
end;
$$;

drop trigger if exists item_wears_reject_future on public.item_wears;
create trigger item_wears_reject_future
  before insert or update of worn_on on public.item_wears
  for each row
  execute function public.reject_future_wear();

-- Same treatment as set_updated_at (007): Postgres checks EXECUTE when a
-- trigger is created, not when it fires, and a trigger helper is not something
-- anything should be calling. Leaving the default grants would be residue
-- rather than a decision.
revoke all on function public.reject_future_wear()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- set_item_wears — a whole day, in one transaction
-- ---------------------------------------------------------------------------
--
-- The 오늘 입은 옷 flow submits a *set*: these garments, that day, and nothing
-- else. Doing it from the client would be a DELETE followed by an INSERT, each
-- its own PostgREST transaction — and a delete that lands while the insert
-- fails is the day's record wiped, which is the one outcome worth a function.
--
-- SECURITY INVOKER, so both statements are still filtered by the policy below.
-- Passing another user's item id is not a hole either: `user_id` is taken from
-- the session rather than from the argument, and the composite foreign key then
-- has no row to point at.
create or replace function public.set_item_wears(
  p_worn_on  date,
  p_item_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_ids  uuid[];
begin
  if v_user is null then
    raise exception 'set_item_wears: 로그인이 필요함'
      using errcode = 'insufficient_privilege';
  end if;

  -- Nulls dropped and duplicates collapsed before either statement. A null
  -- element would make `item_id = any (v_ids)` evaluate to null and quietly
  -- spare a row from the delete; a duplicate would trip the unique constraint
  -- on the insert. Both are shapes a caller can send by accident.
  select coalesce(array_agg(distinct e), array[]::uuid[])
  into v_ids
  from unnest(coalesce(p_item_ids, array[]::uuid[])) as e
  where e is not null;

  -- Unselecting is what this deletes. An empty array is a legitimate call —
  -- "I recorded nothing after all" — and clears the day.
  delete from public.item_wears
  where worn_on = p_worn_on
    and not (item_id = any (v_ids));

  insert into public.item_wears (item_id, user_id, worn_on)
  select e, v_user, p_worn_on
  from unnest(v_ids) as e
  -- Re-submitting a day that already holds some of these is the ordinary case:
  -- the sheet is entered again to add an 아우터. Nothing to update — the row
  -- carries no payload beyond the fact that it exists.
  on conflict (item_id, worn_on) do nothing;
end;
$$;

-- `from public, anon`, not `from public` alone. Supabase's default privileges
-- give every new function in `public` an explicit `anon=X` entry beside the
-- PUBLIC one, and revoking from the pseudo-role leaves that behind — the
-- correction migration 006 exists for.
revoke all on function public.set_item_wears(date, uuid[]) from public, anon;

grant execute on function public.set_item_wears(date, uuid[])
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.item_wears enable row level security;

-- Policies have no CREATE ... IF NOT EXISTS, so this is dropped first and the
-- migration stays re-runnable.
drop policy if exists "item wears are private to their owner" on public.item_wears;

create policy "item wears are private to their owner"
  on public.item_wears
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
