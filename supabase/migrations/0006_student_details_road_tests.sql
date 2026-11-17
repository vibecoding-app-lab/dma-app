-- Student sign-up details and road tests.
-- Safe to run more than once.

-- 1. Details every student gives when signing up.
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists license_number text;
alter table public.profiles add column if not exists license_expiry date;
alter table public.profiles add column if not exists license_class text;

alter table public.profiles drop constraint if exists profiles_license_class_check;
alter table public.profiles add constraint profiles_license_class_check
  check (license_class is null or license_class in ('G1', 'G2', 'G'));

-- 2. One road test per student, booked by their instructor.
create table if not exists public.road_tests (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  instructor_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  location text not null check (length(trim(location)) > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.road_tests enable row level security;

-- The student, their instructor and the school can see it. Changes go through the functions below.
drop policy if exists "read own road test" on public.road_tests;
create policy "read own road test" on public.road_tests
  for select using (
    student_id = auth.uid()
    or instructor_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = road_tests.student_id and p.assigned_instructor_id = auth.uid())
    or public.is_admin()
  );

-- The instructor books or changes a student's road test. The student gets a notification.
create or replace function public.set_road_test(
  p_student_id uuid,
  p_starts_at timestamptz,
  p_location text,
  p_notes text default null
) returns public.road_tests
language plpgsql security definer set search_path = public as $$
declare
  result public.road_tests;
  existed boolean;
  who text;
begin
  if not exists (
    select 1 from public.profiles
     where id = p_student_id and role = 'student'
       and (assigned_instructor_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'This student is not assigned to you';
  end if;
  if p_starts_at is null then raise exception 'Please pick the date and time of the road test'; end if;
  if coalesce(trim(p_location), '') = '' then raise exception 'Please enter where the road test is'; end if;

  select exists (select 1 from public.road_tests where student_id = p_student_id) into existed;

  insert into public.road_tests (student_id, instructor_id, starts_at, location, notes)
  values (p_student_id, auth.uid(), p_starts_at, trim(p_location), nullif(trim(coalesce(p_notes, '')), ''))
  on conflict (student_id) do update
    set instructor_id = excluded.instructor_id,
        starts_at = excluded.starts_at,
        location = excluded.location,
        notes = excluded.notes,
        updated_at = now()
  returning * into result;

  select coalesce(full_name, 'Your instructor') into who from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, message)
  values (
    p_student_id,
    who || case when existed then ' changed your road test: ' else ' booked your road test: ' end
      || '{t:' || to_char(p_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '} at ' || result.location || '.'
  );
  return result;
end;
$$;

-- The instructor removes a student's road test (for example if it was cancelled).
create or replace function public.clear_road_test(p_student_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  who text;
begin
  if not exists (
    select 1 from public.profiles
     where id = p_student_id and role = 'student'
       and (assigned_instructor_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'This student is not assigned to you';
  end if;
  delete from public.road_tests where student_id = p_student_id;
  if found then
    select coalesce(full_name, 'Your instructor') into who from public.profiles where id = auth.uid();
    insert into public.notifications (user_id, message)
    values (p_student_id, who || ' removed your road test booking.');
  end if;
end;
$$;

revoke all on function public.set_road_test(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.set_road_test(uuid, timestamptz, text, text) to authenticated;
revoke all on function public.clear_road_test(uuid) from public, anon;
grant execute on function public.clear_road_test(uuid) to authenticated;
grant select on public.road_tests to authenticated;
