-- Article2IELTS database for Supabase (PostgreSQL).
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to run again: it only creates what is missing and replaces functions.
--
-- Security model
--   * Every table has Row Level Security: a user can only read and write their own rows.
--   * Admins (profiles.role = 'admin') can read everyone's data and manage users
--     through the admin_* functions below, which check the caller's role themselves.
--   * The very first account that signs up becomes an admin automatically.
--   * API keys for AI services are never sent to the database.

-- ---------- tables ----------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null default '',
  name          text not null default '',
  level         text not null default '',
  target        text not null default '',
  role          text not null default 'user' check (role in ('user', 'admin')),
  blocked       boolean not null default false,
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists profiles_created_idx on public.profiles (created_at desc);
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc);
create index if not exists profiles_email_idx on public.profiles (lower(email));

create table if not exists public.tests (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  id          text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.progress (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  test_id     text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, test_id)
);

create table if not exists public.words (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  word        text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, word)
);

create table if not exists public.attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  test_id    text not null,
  title      text not null default '',
  at         timestamptz not null,
  correct    int not null,
  total      int not null,
  band       numeric(3, 1) not null,
  by_type    jsonb not null default '{}'::jsonb,
  seconds    int not null default 0,
  over_time  boolean not null default false,
  unique (user_id, test_id, at)
);
create index if not exists attempts_user_at_idx on public.attempts (user_id, at desc);
create index if not exists attempts_at_idx on public.attempts (at desc);

-- ---------- helper functions ----------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not blocked);
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not blocked);
$$;

-- New sign-up → profile. The first account ever becomes an admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, level, target, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'level', ''),
    coalesce(new.raw_user_meta_data ->> 'target', ''),
    case when exists (select 1 from public.profiles where role = 'admin') then 'user' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own name, level, target and settings, but not their role, block or email.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.blocked := old.blocked;
    new.email := old.email;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------- row level security ----------

alter table public.profiles enable row level security;
alter table public.tests enable row level security;
alter table public.progress enable row level security;
alter table public.words enable row level security;
alter table public.attempts enable row level security;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: update own or admin" on public.profiles;
create policy "profiles: update own or admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['tests', 'progress', 'words', 'attempts'] loop
    execute format('drop policy if exists "%1$s: own rows" on public.%1$I', t);
    execute format('create policy "%1$s: own rows" on public.%1$I for all
                    using (user_id = auth.uid() and public.is_active_user())
                    with check (user_id = auth.uid() and public.is_active_user())', t);
    execute format('drop policy if exists "%1$s: admin read" on public.%1$I', t);
    execute format('create policy "%1$s: admin read" on public.%1$I for select using (public.is_admin())', t);
  end loop;
end $$;

-- ---------- functions the site calls ----------

create or replace function public.touch_last_seen() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_overview() returns json
language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  perform public.require_admin();
  select json_build_object(
    'users_total',    (select count(*) from public.profiles),
    'users_new_7d',   (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_7d',      (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'active_1d',      (select count(*) from public.profiles where last_seen_at > now() - interval '1 day'),
    'admins',         (select count(*) from public.profiles where role = 'admin'),
    'blocked',        (select count(*) from public.profiles where blocked),
    'attempts_total', (select count(*) from public.attempts),
    'attempts_7d',    (select count(*) from public.attempts where at > now() - interval '7 days'),
    'avg_band',       (select round(avg(band), 1) from public.attempts),
    'tests_total',    (select count(*) from public.tests),
    'words_total',    (select count(*) from public.words)
  ) into result;
  return result;
end;
$$;

-- Sign-ups and finished tests per day, for the chart.
create or replace function public.admin_daily(days int default 30)
returns table (day date, signups bigint, attempts bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
    select d::date,
           (select count(*) from public.profiles p where p.created_at::date = d::date),
           (select count(*) from public.attempts a where a.at::date = d::date)
    from generate_series(current_date - (greatest(days, 1) - 1), current_date, interval '1 day') d
    order by 1;
end;
$$;

create or replace function public.admin_list_users(
  search text default '', sort text default 'created', lim int default 50, off int default 0)
returns table (
  id uuid, email text, name text, role text, blocked boolean, level text, target text,
  created_at timestamptz, last_seen_at timestamptz,
  tests_taken bigint, avg_band numeric, best_band numeric, last_attempt timestamptz, words_count bigint,
  total_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  n bigint;
  q text := coalesce(search, '');
begin
  perform public.require_admin();
  lim := greatest(1, least(lim, 500));
  off := greatest(off, 0);
  select count(*) into n from public.profiles p
    where q = '' or p.email ilike '%' || q || '%' or p.name ilike '%' || q || '%';

  if sort in ('tests', 'band') then
    -- Sorting by results needs every user's numbers (fine for tens of thousands of users).
    return query
      select p.id, p.email, p.name, p.role, p.blocked, p.level, p.target, p.created_at, p.last_seen_at,
             coalesce(a.cnt, 0), a.avg_band, a.best_band, a.last_at,
             (select count(*) from public.words w where w.user_id = p.id), n
      from public.profiles p
      left join lateral (
        select count(*) as cnt, round(avg(x.band), 1) as avg_band, max(x.band) as best_band, max(x.at) as last_at
        from public.attempts x where x.user_id = p.id) a on true
      where q = '' or p.email ilike '%' || q || '%' or p.name ilike '%' || q || '%'
      order by case when sort = 'tests' then coalesce(a.cnt, 0) end desc,
               case when sort = 'band' then a.avg_band end desc nulls last,
               p.created_at desc
      limit lim offset off;
  else
    -- Pick the page first, then count results only for those users (fast with any number of users).
    return query
      with page as (
        select * from public.profiles p
        where q = '' or p.email ilike '%' || q || '%' or p.name ilike '%' || q || '%'
        order by case when sort = 'name' then lower(p.name) end asc,
                 case when sort = 'active' then p.last_seen_at end desc,
                 p.created_at desc
        limit lim offset off)
      select p.id, p.email, p.name, p.role, p.blocked, p.level, p.target, p.created_at, p.last_seen_at,
             coalesce(a.cnt, 0), a.avg_band, a.best_band, a.last_at,
             (select count(*) from public.words w where w.user_id = p.id), n
      from page p
      left join lateral (
        select count(*) as cnt, round(avg(x.band), 1) as avg_band, max(x.band) as best_band, max(x.at) as last_at
        from public.attempts x where x.user_id = p.id) a on true
      order by case when sort = 'name' then lower(p.name) end asc,
               case when sort = 'active' then p.last_seen_at end desc,
               p.created_at desc;
  end if;
end;
$$;

create or replace function public.admin_user_attempts(uid uuid, lim int default 50)
returns setof public.attempts
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query select * from public.attempts where user_id = uid order by at desc limit least(lim, 500);
end;
$$;

create or replace function public.admin_set_role(uid uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if uid = auth.uid() and new_role <> 'admin' then
    raise exception 'You cannot remove your own admin role';
  end if;
  update public.profiles set role = new_role where id = uid;
end;
$$;

create or replace function public.admin_set_blocked(uid uuid, value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if uid = auth.uid() then
    raise exception 'You cannot block yourself';
  end if;
  update public.profiles set blocked = value where id = uid;
end;
$$;

-- Deletes the account and (through the foreign keys) all of its data.
create or replace function public.admin_delete_user(uid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  if uid = auth.uid() then
    raise exception 'You cannot delete your own account here';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.admin_overview(), public.admin_daily(int), public.admin_list_users(text, text, int, int),
  public.admin_user_attempts(uuid, int), public.admin_set_role(uuid, text), public.admin_set_blocked(uuid, boolean),
  public.admin_delete_user(uuid), public.touch_last_seen() from public, anon;
grant execute on function public.admin_overview(), public.admin_daily(int), public.admin_list_users(text, text, int, int),
  public.admin_user_attempts(uuid, int), public.admin_set_role(uuid, text), public.admin_set_blocked(uuid, boolean),
  public.admin_delete_user(uuid), public.touch_last_seen() to authenticated;
