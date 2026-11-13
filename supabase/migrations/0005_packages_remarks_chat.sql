-- Packages, lesson remarks, a message with a suggested time, and chat.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Packages: which package a student bought and how many lessons it includes.
-- Package 1 and 2 = 10 lessons, package 3 = 15, private = set by hand.
-- One lesson = one hour, so a 2 hour lesson uses 2.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists package text;
alter table public.profiles add column if not exists lessons_total integer;
-- Extra lessons the instructor adds on top of the package.
alter table public.profiles add column if not exists extra_lessons integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_package_check') then
    alter table public.profiles add constraint profiles_package_check
      check (package is null or package in ('package_1', 'package_2', 'package_3', 'private'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_extra_lessons_check') then
    alter table public.profiles add constraint profiles_extra_lessons_check
      check (extra_lessons between 0 and 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_lessons_total_check') then
    alter table public.profiles add constraint profiles_lessons_total_check
      check (lessons_total is null or lessons_total between 1 and 500);
  end if;
end $$;

-- Students can't change their own package.
create or replace function public.guard_profile_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin()
     or current_setting('dma.allow_assignment', true) = 'on' then
    return new; -- service role, admin, or the instructor functions below
  end if;
  if new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.assigned_instructor_id is distinct from old.assigned_instructor_id
     or new.package is distinct from old.package
     or new.lessons_total is distinct from old.lessons_total
     or new.extra_lessons is distinct from old.extra_lessons then
    raise exception 'Only the school can change role, email, instructor or package';
  end if;
  return new;
end;
$$;

-- An instructor sets the package of one of their own students.
create or replace function public.set_student_package(p_student_id uuid, p_package text, p_lessons_total integer default null)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  total integer;
  result public.profiles;
begin
  if not exists (
    select 1 from public.profiles
     where id = p_student_id and role = 'student'
       and (assigned_instructor_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'This student is not assigned to you';
  end if;

  total := case p_package
    when 'package_1' then 10
    when 'package_2' then 10
    when 'package_3' then 15
    when 'private' then p_lessons_total
  end;
  if p_package not in ('package_1', 'package_2', 'package_3', 'private') then
    raise exception 'Unknown package';
  end if;
  if total is null or total < 1 or total > 500 then
    raise exception 'Enter the number of lessons for a private student';
  end if;

  perform set_config('dma.allow_assignment', 'on', true);
  update public.profiles set package = p_package, lessons_total = total
   where id = p_student_id
  returning * into result;
  return result;
end;
$$;

grant execute on function public.set_student_package(uuid, text, integer) to authenticated;

-- An instructor sets how many extra lessons one of their students has.
create or replace function public.set_extra_lessons(p_student_id uuid, p_extra integer)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  result public.profiles;
begin
  if not exists (
    select 1 from public.profiles
     where id = p_student_id and role = 'student'
       and (assigned_instructor_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'This student is not assigned to you';
  end if;
  if p_extra is null or p_extra < 0 or p_extra > 500 then
    raise exception 'Extra lessons must be between 0 and 500';
  end if;
  perform set_config('dma.allow_assignment', 'on', true);
  update public.profiles set extra_lessons = p_extra where id = p_student_id
  returning * into result;
  return result;
end;
$$;

grant execute on function public.set_extra_lessons(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Lessons: a message with a suggested time, and the instructor's remarks.
-- ---------------------------------------------------------------------------

alter table public.bookings add column if not exists proposal_message text;
alter table public.bookings add column if not exists remarks text;
alter table public.bookings add column if not exists remarks_at timestamptz;
-- Skills worked on in the lesson: [{"skill": "Parallel parking", "level": "good", "note": "..."}]
alter table public.bookings add column if not exists remarks_items jsonb;

-- ---------------------------------------------------------------------------
-- Chat between a student and their instructor.
-- ---------------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  instructor_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_pair_idx on public.messages (student_id, instructor_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "read own chats" on public.messages;
create policy "read own chats" on public.messages
  for select using (student_id = auth.uid() or instructor_id = auth.uid());

-- Students write to their own instructor; instructors to their own students.
drop policy if exists "send in own chats" on public.messages;
create policy "send in own chats" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      (student_id = auth.uid() and instructor_id = public.my_instructor_id())
      or (
        instructor_id = auth.uid()
        and exists (select 1 from public.profiles p where p.id = student_id and p.assigned_instructor_id = auth.uid())
      )
    )
  );

-- Marks the other person's messages in one chat as read.
create or replace function public.mark_chat_read(p_student_id uuid, p_instructor_id uuid)
returns void
language sql security definer set search_path = public as $$
  update public.messages
     set read_at = now()
   where student_id = p_student_id
     and instructor_id = p_instructor_id
     and read_at is null
     and sender_id <> auth.uid()
     and auth.uid() in (p_student_id, p_instructor_id)
$$;

grant execute on function public.mark_chat_read(uuid, uuid) to authenticated;

-- Live updates for chat, when the database has Supabase's realtime feature.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
     ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
