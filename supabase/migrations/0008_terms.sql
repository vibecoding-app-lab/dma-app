-- Students accept the Terms and Conditions when they sign up.
-- Safe to run more than once.
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;
