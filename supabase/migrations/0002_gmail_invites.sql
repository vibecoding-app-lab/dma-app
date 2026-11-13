-- Gmail ignores dots and "+tags" in addresses, so hammad.hanif@gmail.com and
-- hammadhanif@gmail.com are the same inbox. Match instructor invites that way.

create function public.normalize_email(addr text) returns text
language sql immutable as $$
  select case
    when split_part(lower(trim(addr)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(trim(addr)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(trim(addr))
  end
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  invited boolean;
begin
  select exists (
    select 1 from public.instructor_invites
     where public.normalize_email(email) = public.normalize_email(new.email)
  ) into invited;

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

-- Students added by an instructor are matched the same way.
create or replace function public.assign_student(student_email text) returns public.profiles
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
   where public.normalize_email(email) = public.normalize_email(student_email) and role = 'student'
  returning * into result;

  if result.id is null then
    raise exception 'No student account found for %', student_email;
  end if;
  return result;
end;
$$;
