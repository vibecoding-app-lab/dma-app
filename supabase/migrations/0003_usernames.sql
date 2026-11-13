-- Students can sign in with a username as well as their email.

alter table public.profiles add column username text
  check (username ~ '^[a-z0-9_.]{3,20}$');

create unique index profiles_username_key on public.profiles (username);

-- Is a username free? Callable before sign-up, so anon can use it.
create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(trim(p_username)))
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- New auth user -> profile, now also saving the chosen username.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  invited boolean;
  chosen text := nullif(lower(trim(new.raw_user_meta_data ->> 'username')), '');
begin
  select exists (
    select 1 from public.instructor_invites
     where public.normalize_email(email) = public.normalize_email(new.email)
  ) into invited;

  insert into public.profiles (id, role, full_name, phone, email, username)
  values (
    new.id,
    case when invited then 'instructor'::public.user_role else 'student'::public.user_role end,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'phone',
    lower(new.email),
    chosen
  );

  if invited then
    insert into public.instructors (profile_id) values (new.id);
  end if;

  return new;
end;
$$;
