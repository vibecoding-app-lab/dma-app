-- Drive Master Academy: initial schema (phase 1)
-- Roles, profiles, instructor setup, availability and bookings.

create extension if not exists btree_gist;

create type public.user_role as enum ('student', 'instructor', 'admin');
create type public.booking_status as enum ('pending', 'confirmed', 'declined', 'cancelled', 'completed');
create type public.exception_kind as enum ('off', 'extra');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Emails the school owner adds here become instructors when they first sign in.
create table public.instructor_invites (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'student',
  full_name text,
  phone text,
  email text not null,
  push_token text,
  assigned_instructor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint only_students_are_assigned check (assigned_instructor_id is null or role = 'student')
);

create index profiles_assigned_instructor_idx on public.profiles (assigned_instructor_id);

create table public.instructors (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  bio text,
  car_type text check (car_type in ('manual', 'automatic')),
  google_calendar_id text not null default 'primary',
  google_connected_at timestamptz,
  timezone text not null default 'UTC'
);

-- Google refresh tokens. RLS is on with no policies, so only the
-- service role (edge functions) can read or write this table.
create table public.instructor_google_tokens (
  instructor_id uuid primary key references public.instructors (profile_id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (profile_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  buffer_min smallint not null default 0 check (buffer_min between 0 and 120),
  check (end_time > start_time)
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (profile_id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  kind public.exception_kind not null,
  check (kind = 'off' or (start_time is not null and end_time is not null and end_time > start_time))
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  instructor_id uuid not null references public.instructors (profile_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'pending',
  pickup_location text,
  notes text,
  google_event_id text,
  cancelled_by uuid references public.profiles (id),
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lessons are 1 or 2 hours.
  constraint lesson_length check (ends_at - starts_at in (interval '1 hour', interval '2 hours')),
  -- No two pending or confirmed lessons for one instructor may overlap.
  constraint no_double_booking exclude using gist (
    instructor_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending', 'confirmed'))
);

create index bookings_student_idx on public.bookings (student_id, starts_at);
create index bookings_instructor_idx on public.bookings (instructor_id, starts_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.current_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_instructor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role() in ('instructor', 'admin'), false)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role() = 'admin', false)
$$;

create function public.my_instructor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select assigned_instructor_id from public.profiles where id = auth.uid()
$$;

-- New auth user -> profile (+ instructor row when invited).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  invited boolean;
begin
  select exists (select 1 from public.instructor_invites where email = lower(new.email)) into invited;

  insert into public.profiles (id, role, full_name, phone, email)
  values (
    new.id,
    case when invited then 'instructor'::public.user_role else 'student'::public.user_role end,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'phone',
    lower(new.email)
  );

  if invited then
    insert into public.instructors (profile_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own name, phone and push token, nothing else.
create function public.guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin()
     or current_setting('dma.allow_assignment', true) = 'on' then
    return new; -- service role, admin, or assign_student / unassign_student
  end if;
  if new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.assigned_instructor_id is distinct from old.assigned_instructor_id then
    raise exception 'Only the school can change role, email or assigned instructor';
  end if;
  return new;
end;
$$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Instructor assigns a student (by email) to themself.
create function public.assign_student(student_email text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  result public.profiles;
begin
  if not public.is_instructor() then
    raise exception 'Only instructors can assign students';
  end if;
  perform set_config('dma.allow_assignment', 'on', true);

  update public.profiles
     set assigned_instructor_id = auth.uid()
   where email = lower(trim(student_email)) and role = 'student'
  returning * into result;

  if result.id is null then
    raise exception 'No student account found for %', student_email;
  end if;
  return result;
end;
$$;

-- Instructor removes a student from their list.
create function public.unassign_student(student_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('dma.allow_assignment', 'on', true);
  update public.profiles
     set assigned_instructor_id = null
   where id = student_id
     and (assigned_instructor_id = auth.uid() or public.is_admin());
end;
$$;

-- Booking rules that depend on who is acting.
create function public.guard_booking() returns trigger
language plpgsql set search_path = public as $$
declare
  actor uuid := auth.uid();
begin
  new.updated_at := now();

  if actor is null or public.is_admin() then
    return new; -- service role or admin
  end if;

  if tg_op = 'INSERT' then
    if new.student_id <> actor then
      raise exception 'Students can only book for themselves';
    end if;
    if new.instructor_id is distinct from public.my_instructor_id() then
      raise exception 'Students can only book their assigned instructor';
    end if;
    if new.status <> 'pending' then
      raise exception 'New bookings start as pending';
    end if;
    if new.starts_at <= now() then
      raise exception 'Lessons must be booked in the future';
    end if;
    return new;
  end if;

  -- UPDATE by the student: only cancel, and only 24h or more ahead.
  if actor = old.student_id and actor <> old.instructor_id then
    if new.status <> 'cancelled'
       or new.starts_at <> old.starts_at or new.ends_at <> old.ends_at
       or new.instructor_id <> old.instructor_id then
      raise exception 'Students can only cancel a lesson';
    end if;
    if old.starts_at - now() < interval '24 hours' then
      raise exception 'Lessons can only be cancelled 24 hours or more in advance';
    end if;
    new.cancelled_by := actor;
  end if;

  -- UPDATE by the instructor: anything except reassigning the lesson.
  if actor = old.instructor_id then
    if new.student_id <> old.student_id or new.instructor_id <> old.instructor_id then
      raise exception 'A lesson cannot be moved to another student or instructor';
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      new.cancelled_by := actor;
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_booking
  before insert or update on public.bookings
  for each row execute function public.guard_booking();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.instructor_invites enable row level security;
alter table public.profiles enable row level security;
alter table public.instructors enable row level security;
alter table public.instructor_google_tokens enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.bookings enable row level security;

create policy "admins manage invites" on public.instructor_invites
  for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: yourself, your assigned instructor, your assigned students.
create policy "read own and related profiles" on public.profiles
  for select using (
    id = auth.uid()
    or assigned_instructor_id = auth.uid()
    or id = public.my_instructor_id()
    or public.is_admin()
  );

create policy "update own profile" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Instructors: everyone signed in can read; instructors edit their own row.
create policy "read instructors" on public.instructors
  for select using (auth.uid() is not null);

create policy "instructors update own row" on public.instructors
  for update using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

-- Availability: readable by signed-in users, editable by the owning instructor.
create policy "read availability rules" on public.availability_rules
  for select using (auth.uid() is not null);
create policy "instructors manage own rules" on public.availability_rules
  for all using (instructor_id = auth.uid() or public.is_admin())
  with check (instructor_id = auth.uid() or public.is_admin());

create policy "read availability exceptions" on public.availability_exceptions
  for select using (auth.uid() is not null);
create policy "instructors manage own exceptions" on public.availability_exceptions
  for all using (instructor_id = auth.uid() or public.is_admin())
  with check (instructor_id = auth.uid() or public.is_admin());

-- Bookings: students see their own, instructors see theirs.
create policy "read own bookings" on public.bookings
  for select using (student_id = auth.uid() or instructor_id = auth.uid() or public.is_admin());

create policy "students request bookings" on public.bookings
  for insert with check (student_id = auth.uid());

create policy "participants update bookings" on public.bookings
  for update using (student_id = auth.uid() or instructor_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or instructor_id = auth.uid() or public.is_admin());

-- Busy times for a student's assigned instructor, without exposing other
-- students' details. Used by the slot picker in phase 2.
create function public.instructor_busy_times(p_instructor_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.starts_at, b.ends_at
    from public.bookings b
   where b.instructor_id = p_instructor_id
     and b.status in ('pending', 'confirmed')
     and b.starts_at < p_to and b.ends_at > p_from
     and auth.uid() is not null
$$;

grant execute on function public.assign_student(text) to authenticated;
grant execute on function public.unassign_student(uuid) to authenticated;
grant execute on function public.instructor_busy_times(uuid, timestamptz, timestamptz) to authenticated;
