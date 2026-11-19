-- Student transfers, more sign-up details, instructor numbers and in-car sheets.
-- Safe to run more than once.

-- 1. More sign-up details for students.
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists postal_code text;
alter table public.profiles add column if not exists license_issue_date date;

-- Fill first/last name from the full name students already gave.
update public.profiles
   set first_name = coalesce(first_name, split_part(trim(full_name), ' ', 1)),
       last_name = coalesce(last_name, nullif(trim(substr(trim(full_name), length(split_part(trim(full_name), ' ', 1)) + 1)), ''))
 where full_name is not null and (first_name is null or last_name is null);

-- 2. Instructor details printed on the in-car sheet.
alter table public.profiles add column if not exists di_number text;
alter table public.profiles add column if not exists di_licence_expiry_year text;

-- 3. Move a student to another instructor (found by their email).
create or replace function public.transfer_student(p_student_id uuid, p_instructor_email text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  target public.profiles;
  student public.profiles;
  me text;
begin
  select * into student from public.profiles
   where id = p_student_id and role = 'student'
     and (assigned_instructor_id = auth.uid() or public.is_admin());
  if student.id is null then
    raise exception 'This student is not assigned to you';
  end if;

  select * into target from public.profiles
   where public.normalize_email(email) = public.normalize_email(p_instructor_email)
     and role in ('instructor', 'admin');
  if target.id is null then
    raise exception 'No instructor is registered with %. Ask them to sign in to the app as an instructor first.', trim(p_instructor_email);
  end if;
  if target.id = student.assigned_instructor_id then
    raise exception '% is already this student''s instructor', coalesce(target.full_name, target.email);
  end if;

  perform set_config('dma.allow_assignment', 'on', true);
  update public.profiles set assigned_instructor_id = target.id where id = student.id returning * into student;

  select coalesce(full_name, 'Your instructor') into me from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, message) values
    (student.id, 'You have been moved to a new instructor: ' || coalesce(target.full_name, target.email) || '. Book your next lessons with them.'),
    (target.id, me || ' transferred a student to you: ' || coalesce(student.full_name, student.email) || '.');
  return student;
end;
$$;

revoke all on function public.transfer_student(uuid, text) from public, anon;
grant execute on function public.transfer_student(uuid, text) to authenticated;

-- 4. In-car sheet: what the instructor filled in on each student's sheet. Instructors only.
create table if not exists public.in_car_sheets (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.in_car_sheets enable row level security;

drop policy if exists "instructor reads in-car sheet" on public.in_car_sheets;
create policy "instructor reads in-car sheet" on public.in_car_sheets
  for select using (
    public.is_admin()
    or exists (select 1 from public.profiles p where p.id = in_car_sheets.student_id and p.assigned_instructor_id = auth.uid())
  );

drop policy if exists "instructor adds in-car sheet" on public.in_car_sheets;
create policy "instructor adds in-car sheet" on public.in_car_sheets
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.profiles p where p.id = in_car_sheets.student_id and p.assigned_instructor_id = auth.uid())
  );

drop policy if exists "instructor updates in-car sheet" on public.in_car_sheets;
create policy "instructor updates in-car sheet" on public.in_car_sheets
  for update using (
    public.is_admin()
    or exists (select 1 from public.profiles p where p.id = in_car_sheets.student_id and p.assigned_instructor_id = auth.uid())
  );

grant select, insert, update on public.in_car_sheets to authenticated;
