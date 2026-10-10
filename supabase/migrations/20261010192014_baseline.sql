-- =====================================================================
-- 1. Tables
-- =====================================================================
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid references public.families (id) on delete set null,
  role text not null,
  is_emergency boolean not null default false
);

create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  med_name text not null,
  status text not null default 'pending',
  updated_at timestamptz not null default now()
);

create index if not exists profiles_family_id_idx on public.profiles (family_id);
create index if not exists medication_logs_family_id_idx on public.medication_logs (family_id);

-- =====================================================================
-- 2. Fixes for tables that already existed
-- =====================================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'medication_logs'
      and column_name = 'updated_at'
      and data_type = 'timestamp without time zone'
  ) then
    alter table public.medication_logs
      alter column updated_at type timestamptz using updated_at at time zone 'UTC';
  end if;
end
$$;

alter table public.medication_logs alter column id set default gen_random_uuid();
alter table public.medication_logs alter column status set default 'pending';
alter table public.medication_logs alter column updated_at set default now();
alter table public.profiles alter column is_emergency set default false;

-- =====================================================================
-- 3. Constraints
-- =====================================================================
alter table public.medication_logs drop constraint if exists medication_logs_status_check;
update public.medication_logs set status = 'taken' where status = 'completed';
alter table public.medication_logs
  add constraint medication_logs_status_check
  check (status in ('pending', 'taken', 'missed'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('caregiver', 'elderly'));

-- =====================================================================
-- 4. Signup: create profile (and family) inside the database
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := new.raw_user_meta_data ->> 'role';
  v_code text := new.raw_user_meta_data ->> 'family_code';
  v_family_id uuid;
begin
  if v_role = 'caregiver' then
    insert into public.families (name)
    values (coalesce(new.email, 'New') || '''s Family')
    returning id into v_family_id;

  elsif v_role = 'elderly' then
    begin
      select id into v_family_id from public.families where id = v_code::uuid;
    exception when invalid_text_representation then
      v_family_id := null;
    end;

    if v_family_id is null then
      raise exception 'Invalid family code';
    end if;

  else
    raise exception 'Invalid role';
  end if;

  insert into public.profiles (id, role, family_id, is_emergency)
  values (new.id, v_role, v_family_id, false);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.family_code_is_valid(code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (select 1 from public.families where id = code::uuid);
exception when invalid_text_representation then
  return false;
end;
$$;

revoke all on function public.family_code_is_valid(text) from public;
grant execute on function public.family_code_is_valid(text) to anon, authenticated;

-- =====================================================================
-- 5. Row level security
-- =====================================================================
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'families', 'medication_logs')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

create or replace function public.auth_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.profiles where id = (select auth.uid());
$$;

create or replace function public.auth_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.auth_family_id() from public, anon;
revoke all on function public.auth_user_role() from public, anon;
grant execute on function public.auth_family_id() to authenticated;
grant execute on function public.auth_user_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.medication_logs enable row level security;

revoke all on public.profiles, public.families, public.medication_logs from anon, authenticated;

grant select on public.profiles, public.families, public.medication_logs to authenticated;
grant update (is_emergency) on public.profiles to authenticated;
grant insert on public.medication_logs to authenticated;
grant update (status, updated_at) on public.medication_logs to authenticated;
grant delete on public.medication_logs to authenticated;

create policy "read own and family profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or family_id = (select public.auth_family_id())
);

create policy "update own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "caregivers update family elderly profiles"
on public.profiles for update to authenticated
using (
  family_id = (select public.auth_family_id())
  and role = 'elderly'
  and (select public.auth_user_role()) = 'caregiver'
)
with check (
  family_id = (select public.auth_family_id())
  and role = 'elderly'
);

create policy "read own family"
on public.families for select to authenticated
using (id = (select public.auth_family_id()));

create policy "family reads meds"
on public.medication_logs for select to authenticated
using (family_id = (select public.auth_family_id()));

create policy "caregivers add meds"
on public.medication_logs for insert to authenticated
with check (
  family_id = (select public.auth_family_id())
  and (select public.auth_user_role()) = 'caregiver'
);

create policy "family updates med status"
on public.medication_logs for update to authenticated
using (family_id = (select public.auth_family_id()))
with check (family_id = (select public.auth_family_id()));

create policy "caregivers delete meds"
on public.medication_logs for delete to authenticated
using (
  family_id = (select public.auth_family_id())
  and (select public.auth_user_role()) = 'caregiver'
);

-- =====================================================================
-- 6. Realtime
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'medication_logs'
  ) then
    alter publication supabase_realtime add table public.medication_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;