\set ON_ERROR_STOP 0
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
insert into public.instructor_invites values ('ali@dma.com');
insert into auth.users (id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','Ali@dma.com','{"full_name":"Ali"}'),
 ('00000000-0000-0000-0000-00000000000b','sara@x.com','{"full_name":"Sara","phone":"123"}'),
 ('00000000-0000-0000-0000-00000000000c','tom@x.com','{}');
select email, role, full_name from profiles order by email;
select count(*) as instructor_rows from instructors;
-- act as instructor
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select email from assign_student('Sara@x.com');
select email, assigned_instructor_id is not null as assigned from profiles order by email;
-- act as student Sara
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select email from profiles order by email;  -- expect sara + ali
update profiles set role='admin' where id=auth.uid();  -- expect error
update profiles set full_name='Sara K' where id=auth.uid();
insert into bookings (student_id,instructor_id,starts_at,ends_at) values (auth.uid(),'00000000-0000-0000-0000-00000000000a', now()+interval '3 days', now()+interval '3 days 1 hour');
insert into bookings (student_id,instructor_id,starts_at,ends_at) values (auth.uid(),'00000000-0000-0000-0000-00000000000a', now()+interval '3 days 30 min', now()+interval '3 days 90 min'); -- overlap error
insert into bookings (student_id,instructor_id,starts_at,ends_at) values (auth.uid(),'00000000-0000-0000-0000-00000000000a', now()+interval '5 days', now()+interval '5 days 90 min'); -- length error
insert into bookings (student_id,instructor_id,starts_at,ends_at) values (auth.uid(),'00000000-0000-0000-0000-00000000000a', now()+interval '10 hours', now()+interval '11 hours');
update bookings set status='cancelled' where starts_at < now()+interval '1 day'; -- 24h error
update bookings set status='confirmed' where starts_at > now()+interval '1 day'; -- error
update bookings set status='cancelled' where starts_at > now()+interval '1 day';
-- Tom (unassigned) tries to book Ali
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
insert into bookings (student_id,instructor_id,starts_at,ends_at) values (auth.uid(),'00000000-0000-0000-0000-00000000000a', now()+interval '6 days', now()+interval '6 days 1 hour'); -- error
select count(*) as tom_sees_bookings from bookings;
select count(*) as tom_sees_busy from instructor_busy_times('00000000-0000-0000-0000-00000000000a', now(), now()+interval '30 days');
-- instructor sees bookings and cancels
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select status, cancelled_by is not null as by from bookings order by starts_at;
update bookings set status='cancelled', cancel_reason='car in service' where status='pending';
select status, cancel_reason from bookings order by starts_at;
select count(*) as tokens_visible from instructor_google_tokens;
