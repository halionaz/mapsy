-- Assertion helpers.
--
-- Every failure raises, so `psql -v ON_ERROR_STOP=1` turns the suite into a
-- single exit code. Printing results without failing would make this a report
-- nobody reads rather than a check that blocks a bad migration.

create schema if not exists tests;

create or replace function tests.eq(actual text, expected text, label text)
returns void
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL  % — 기대 %, 실제 %', label, expected, actual;
  end if;
  raise notice '  ok  %', label;
end;
$$;

/** Runs `stmt` and requires it to fail with a message containing `fragment`. */
create or replace function tests.fails(stmt text, fragment text, label text)
returns void
language plpgsql
as $$
declare
  message text;
begin
  begin
    execute stmt;
  exception when others then
    message := sqlerrm;
    if position(fragment in message) = 0 then
      raise exception 'FAIL  % — "%" 를 기대했는데 실제 오류는 "%"', label, fragment, message;
    end if;
    raise notice '  ok  % (%)', label, fragment;
    return;
  end;
  raise exception 'FAIL  % — 실패해야 하는데 성공함', label;
end;
$$;

/**
 * Same, for constraints declared DEFERRABLE INITIALLY DEFERRED.
 *
 * Those are normally checked when the outermost transaction commits, which is
 * long after this block ends — so the check is forced early. Without this the
 * assertion would silently never fire and the test would look like a pass.
 */
create or replace function tests.fails_deferred(stmt text, fragment text, label text)
returns void
language plpgsql
as $$
declare
  message text;
begin
  begin
    execute stmt;
    execute 'set constraints all immediate';
  exception when others then
    message := sqlerrm;
    if position(fragment in message) = 0 then
      raise exception 'FAIL  % — "%" 를 기대했는데 실제 오류는 "%"', label, fragment, message;
    end if;
    raise notice '  ok  % (%)', label, fragment;
    return;
  end;
  raise exception 'FAIL  % — 실패해야 하는데 성공함', label;
end;
$$;

grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;
