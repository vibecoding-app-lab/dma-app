// Every change to a lesson goes through here, so the database and the
// instructor's Google Calendar stay in step.
//
//   request    student asks for a lesson in one of the open slots
//   accept     instructor confirms a request (adds it to Google Calendar)
//   decline    instructor turns a request down
//   cancel     student (24 hours or more ahead) or instructor cancels
//   reschedule instructor suggests a new time or length (student must confirm)
//   accept_proposal / decline_proposal  student answers the suggested time
//
// Each step leaves an in-app notification for the other person.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { googleEventRequest, handle, HttpError, instructorAccessToken, json, requireUser } from '../_shared/google.ts';
import { openSlots } from '../_shared/slots.ts';

const HOUR = 60 * 60 * 1000;

/** {t:ISO} placeholders are shown in the reader's own time by the app. */
const t = (iso: string) => `{t:${when(iso)}}`;

type Booking = {
  id: string;
  student_id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
  pickup_location: string | null;
  notes: string | null;
  google_event_id: string | null;
  proposed_starts_at: string | null;
  proposed_ends_at: string | null;
};

function when(startIso: string) {
  // Times in notifications use the instructor's zone when we know it.
  return new Date(startIso).toISOString();
}

/** Leaves an in-app notification. Never fails the action itself. */
async function tell(admin: SupabaseClient, userId: string, bookingId: string, message: string) {
  const { error } = await admin.from('notifications').insert({ user_id: userId, booking_id: bookingId, message });
  if (error) console.error('notification failed', error.message);
}

async function nameOf(admin: SupabaseClient, id: string) {
  const { data } = await admin.from('profiles').select('full_name, username, email').eq('id', id).single();
  return data?.full_name ?? (data?.username ? `@${data.username}` : (data?.email ?? 'Someone'));
}

function lengthHours(value: unknown): 1 | 2 {
  const n = Number(value);
  if (n !== 1 && n !== 2) throw new HttpError(400, 'Lessons are 1 or 2 hours');
  return n;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().slice(0, max);
  return t || null;
}

/** Friendly message when the database refuses an overlapping lesson. */
function overlapError(error: { code?: string; message: string }): never {
  if (error.code === '23P01') throw new HttpError(409, 'That time was just taken. Please pick another time.');
  throw new HttpError(400, error.message);
}

async function calendarEvent(admin: SupabaseClient, booking: Booking) {
  const { data: student } = await admin
    .from('profiles')
    .select('full_name, phone, email')
    .eq('id', booking.student_id)
    .single();
  const name = student?.full_name ?? student?.email ?? 'Student';
  const lines = [
    student?.phone ? `Phone: ${student.phone}` : null,
    booking.pickup_location ? `Pickup: ${booking.pickup_location}` : null,
    booking.notes ? `Notes: ${booking.notes}` : null,
    'Booked through the Drive Master Academy app.',
  ].filter(Boolean);
  return {
    summary: `Driving lesson: ${name}`,
    description: lines.join('\n'),
    location: booking.pickup_location ?? undefined,
    start: { dateTime: booking.starts_at },
    end: { dateTime: booking.ends_at },
  };
}

/** Puts a confirmed lesson on (or updates it on) the instructor's calendar. */
async function syncToCalendar(admin: SupabaseClient, booking: Booking): Promise<string | null> {
  const token = await instructorAccessToken(admin, booking.instructor_id);
  if (!token) return booking.google_event_id;
  const { data: instructor } = await admin
    .from('instructors')
    .select('google_calendar_id')
    .eq('profile_id', booking.instructor_id)
    .single();
  const calendarId = instructor?.google_calendar_id ?? 'primary';
  const event = await calendarEvent(admin, booking);
  const saved = booking.google_event_id
    ? await googleEventRequest(token, calendarId, 'PATCH', booking.google_event_id, event)
    : await googleEventRequest(token, calendarId, 'POST', null, event);
  return saved?.id ?? booking.google_event_id;
}

async function removeFromCalendar(admin: SupabaseClient, booking: Booking) {
  if (!booking.google_event_id) return;
  const token = await instructorAccessToken(admin, booking.instructor_id);
  if (!token) return;
  const { data: instructor } = await admin
    .from('instructors')
    .select('google_calendar_id')
    .eq('profile_id', booking.instructor_id)
    .single();
  await googleEventRequest(token, instructor?.google_calendar_id ?? 'primary', 'DELETE', booking.google_event_id);
}

Deno.serve(
  handle(async (req) => {
    const { admin, profile } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');
    const isInstructor = profile.role === 'instructor' || profile.role === 'admin';

    // ---- New request from a student -------------------------------------
    if (action === 'request') {
      if (profile.role !== 'student') throw new HttpError(403, 'Only students can request lessons');
      const instructorId = profile.assigned_instructor_id;
      if (!instructorId) throw new HttpError(409, "You haven't been assigned an instructor yet");

      const hours = lengthHours(body.duration_hours);
      const start = Date.parse(String(body.starts_at));
      if (Number.isNaN(start)) throw new HttpError(400, 'Pick a time');

      // The time must still be open right now.
      const days = Math.ceil((start - Date.now()) / (24 * HOUR)) + 1;
      if (days > 31) throw new HttpError(400, 'Lessons can be booked up to 4 weeks ahead');
      const { slots } = await openSlots(admin, instructorId, hours, Math.max(days, 1));
      if (!slots.some((s) => Date.parse(s.start) === start)) {
        throw new HttpError(409, 'That time is no longer available. Please pick another time.');
      }

      const { data, error } = await admin
        .from('bookings')
        .insert({
          student_id: profile.id,
          instructor_id: instructorId,
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(start + hours * HOUR).toISOString(),
          status: 'pending',
          pickup_location: text(body.pickup_location, 200),
          notes: text(body.notes, 500),
        })
        .select()
        .single();
      if (error) overlapError(error);
      await tell(admin, instructorId, data.id, `New lesson request from ${await nameOf(admin, profile.id)} for ${t(data.starts_at)} (${hours}h).`);
      return json({ booking: data });
    }

    // ---- Everything else acts on an existing lesson ---------------------
    const { data: found } = await admin.from('bookings').select('*').eq('id', String(body.booking_id ?? '')).maybeSingle();
    const booking = found as Booking | null;
    const mine = booking && (booking.student_id === profile.id || booking.instructor_id === profile.id || profile.role === 'admin');
    if (!booking || !mine) throw new HttpError(404, 'Lesson not found');
    const ownsAsInstructor = isInstructor && (booking.instructor_id === profile.id || profile.role === 'admin');

    if (action === 'accept' || action === 'decline') {
      if (!ownsAsInstructor) throw new HttpError(403, 'Only the instructor can do this');
      if (booking.status !== 'pending') throw new HttpError(409, 'This request has already been answered');
      if (action === 'accept' && booking.proposed_starts_at) {
        throw new HttpError(409, 'You suggested a new time. Waiting for the student to answer.');
      }

      if (action === 'decline') {
        const { data } = await admin
          .from('bookings')
          .update({ status: 'declined', cancel_reason: text(body.reason, 300), proposed_starts_at: null, proposed_ends_at: null })
          .eq('id', booking.id)
          .select()
          .single();
        await tell(admin, booking.student_id, booking.id, `Your request for ${t(booking.starts_at)} was declined.`);
        return json({ booking: data });
      }

      const eventId = await syncToCalendar(admin, booking);
      const { data } = await admin
        .from('bookings')
        .update({ status: 'confirmed', google_event_id: eventId })
        .eq('id', booking.id)
        .select()
        .single();
      await tell(admin, booking.student_id, booking.id, `Your lesson on ${t(booking.starts_at)} is confirmed.`);
      return json({ booking: data });
    }

    if (action === 'cancel') {
      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        throw new HttpError(409, 'This lesson is not active');
      }
      if (!ownsAsInstructor) {
        // Students: 24 hours or more ahead only.
        if (Date.parse(booking.starts_at) - Date.now() < 24 * HOUR) {
          throw new HttpError(
            409,
            'Lessons can only be cancelled 24 hours or more in advance. Please call your instructor.',
          );
        }
      }
      await removeFromCalendar(admin, booking);
      const { data } = await admin
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: profile.id,
          cancel_reason: text(body.reason, 300),
          google_event_id: null,
          proposed_starts_at: null,
          proposed_ends_at: null,
        })
        .eq('id', booking.id)
        .select()
        .single();
      const other = profile.id === booking.student_id ? booking.instructor_id : booking.student_id;
      await tell(admin, other, booking.id, `${await nameOf(admin, profile.id)} cancelled the lesson on ${t(booking.starts_at)}.`);
      return json({ booking: data });
    }

    if (action === 'reschedule') {
      if (!ownsAsInstructor) throw new HttpError(403, 'Only the instructor can change a lesson');
      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        throw new HttpError(409, 'This lesson is not active');
      }
      const hours = lengthHours(body.duration_hours);
      const start = Date.parse(String(body.starts_at));
      if (Number.isNaN(start)) throw new HttpError(400, 'Pick a time');
      if (start < Date.now()) throw new HttpError(400, 'Pick a time in the future');
      const end = start + hours * HOUR;

      // The new time can't clash with another lesson, request or suggestion.
      const { data: others } = await admin
        .from('bookings')
        .select('starts_at, ends_at, proposed_starts_at, proposed_ends_at')
        .eq('instructor_id', booking.instructor_id)
        .in('status', ['pending', 'confirmed'])
        .neq('id', booking.id);
      const clash = (others ?? []).some(
        (o) =>
          (Date.parse(o.starts_at) < end && start < Date.parse(o.ends_at)) ||
          (o.proposed_starts_at && Date.parse(o.proposed_starts_at) < end && start < Date.parse(o.proposed_ends_at!)),
      );
      if (clash) throw new HttpError(409, 'That time overlaps another lesson or request.');

      const { data } = await admin
        .from('bookings')
        .update({ proposed_starts_at: new Date(start).toISOString(), proposed_ends_at: new Date(end).toISOString() })
        .eq('id', booking.id)
        .select()
        .single();
      await tell(
        admin,
        booking.student_id,
        booking.id,
        `${await nameOf(admin, profile.id)} suggested a new time: ${t(new Date(start).toISOString())} (${hours}h). Please accept or decline.`,
      );
      return json({ booking: data });
    }

    if (action === 'accept_proposal' || action === 'decline_proposal') {
      if (booking.student_id !== profile.id) throw new HttpError(403, 'Only the student can answer this');
      if (!booking.proposed_starts_at || !booking.proposed_ends_at) {
        throw new HttpError(409, 'There is no new time to answer');
      }
      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        throw new HttpError(409, 'This lesson is not active');
      }
      const studentName = await nameOf(admin, profile.id);

      if (action === 'decline_proposal') {
        // A request with no agreed time ends; a confirmed lesson keeps its time.
        const update =
          booking.status === 'pending'
            ? { status: 'cancelled', cancelled_by: profile.id, cancel_reason: 'Student declined the new time', proposed_starts_at: null, proposed_ends_at: null }
            : { proposed_starts_at: null, proposed_ends_at: null };
        const { data } = await admin.from('bookings').update(update).eq('id', booking.id).select().single();
        await tell(
          admin,
          booking.instructor_id,
          booking.id,
          booking.status === 'pending'
            ? `${studentName} declined the new time ${t(booking.proposed_starts_at)}. The request is closed.`
            : `${studentName} declined the new time ${t(booking.proposed_starts_at)}. The lesson stays on ${t(booking.starts_at)}.`,
        );
        return json({ booking: data });
      }

      const { data, error } = await admin
        .from('bookings')
        .update({
          starts_at: booking.proposed_starts_at,
          ends_at: booking.proposed_ends_at,
          proposed_starts_at: null,
          proposed_ends_at: null,
          status: 'confirmed',
        })
        .eq('id', booking.id)
        .select()
        .single();
      if (error) overlapError(error);
      const updated = data as Booking;
      const eventId = await syncToCalendar(admin, updated);
      if (eventId !== updated.google_event_id) {
        await admin.from('bookings').update({ google_event_id: eventId }).eq('id', updated.id);
      }
      await tell(admin, booking.instructor_id, booking.id, `${studentName} accepted the new time ${t(updated.starts_at)}. It's on your calendar.`);
      return json({ booking: updated });
    }

    throw new HttpError(400, 'Unknown action');
  }),
);
