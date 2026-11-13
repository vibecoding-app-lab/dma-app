-- Instructor suggests a new time, student confirms or declines.
-- While waiting, both the original time and the suggested time stay blocked.
-- Safe to run more than once.

alter table public.bookings add column if not exists proposed_starts_at timestamptz;
alter table public.bookings add column if not exists proposed_ends_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'proposal_shape') then
    alter table public.bookings add constraint proposal_shape check (
      (proposed_starts_at is null and proposed_ends_at is null)
      or (proposed_ends_at - proposed_starts_at in (interval '1 hour', interval '2 hours'))
    );
  end if;
end $$;

-- In-app notifications ("Your instructor suggested a new time", ...).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- People read and dismiss their own notifications. Only the server creates them.
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "dismiss own notifications" on public.notifications;
create policy "dismiss own notifications" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
