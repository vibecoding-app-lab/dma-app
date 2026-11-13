// Open lesson slots for an instructor: working hours, minus pending/confirmed
// lessons (plus buffer), minus busy Google Calendar events.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { HttpError, instructorAccessToken, listEvents } from './google.ts';
import { addDays, DAY, type Interval, localDate, overlaps, zonedToUtc } from './time.ts';

const STEP_MIN = 15; // slots start every 15 minutes
const MIN_NOTICE_MS = 2 * 60 * 60 * 1000; // no lessons starting within 2 hours

export type Slot = { start: string; end: string };

export async function openSlots(
  admin: SupabaseClient,
  instructorId: string,
  durationHours: number,
  days: number,
  excludeBookingId: string | null = null,
): Promise<{ timezone: string; slots: Slot[] }> {
  const { data: instructor } = await admin
    .from('instructors')
    .select('profile_id, timezone, google_calendar_id')
    .eq('profile_id', instructorId)
    .single();
  if (!instructor) throw new HttpError(404, 'Instructor not found');
  const tz: string = instructor.timezone || 'UTC';

  const now = Date.now();
  const today = localDate(now, tz).date;
  const lastDate = addDays(today, days);
  const windowStart = zonedToUtc(today, '00:00', tz);
  const windowEnd = zonedToUtc(lastDate, '00:00', tz) + DAY;

  const [{ data: rules }, { data: exceptions }, { data: bookings }] = await Promise.all([
    admin.from('availability_rules').select('weekday, start_time, end_time, buffer_min').eq('instructor_id', instructorId),
    admin
      .from('availability_exceptions')
      .select('date, start_time, end_time, kind')
      .eq('instructor_id', instructorId)
      .gte('date', today)
      .lte('date', lastDate),
    admin
      .from('bookings')
      .select('id, starts_at, ends_at')
      .eq('instructor_id', instructorId)
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', new Date(windowEnd).toISOString())
      .gt('ends_at', new Date(windowStart - DAY).toISOString()),
  ]);

  const bufferMs = Math.max(0, ...(rules ?? []).map((r) => r.buffer_min ?? 0)) * 60_000;

  // Everything that blocks time.
  const busy: Interval[] = [];
  const ownEventIds = new Set<string>();
  for (const b of bookings ?? []) {
    if (b.id === excludeBookingId) continue;
    busy.push({ start: Date.parse(b.starts_at) - bufferMs, end: Date.parse(b.ends_at) + bufferMs });
  }
  if (excludeBookingId) {
    const { data: excluded } = await admin.from('bookings').select('google_event_id').eq('id', excludeBookingId).maybeSingle();
    if (excluded?.google_event_id) ownEventIds.add(excluded.google_event_id);
  }

  const accessToken = await instructorAccessToken(admin, instructorId);
  if (accessToken) {
    const events = await listEvents(accessToken, instructor.google_calendar_id, windowStart, windowEnd, zonedToUtc, tz);
    for (const e of events) {
      if (e.busy && !ownEventIds.has(e.id)) busy.push({ start: e.start, end: e.end });
    }
  }

  const durationMs = durationHours * 60 * 60 * 1000;
  const earliest = now + MIN_NOTICE_MS;
  const slots: { start: string; end: string }[] = [];

  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const dayExceptions = (exceptions ?? []).filter((e) => e.date === date);
    if (dayExceptions.some((e) => e.kind === 'off' && !e.start_time)) continue; // whole day off

    const windows: Interval[] = [];
    for (const r of rules ?? []) {
      if (r.weekday === weekday) {
        windows.push({ start: zonedToUtc(date, r.start_time, tz), end: zonedToUtc(date, r.end_time, tz) });
      }
    }
    for (const e of dayExceptions) {
      const w = { start: zonedToUtc(date, e.start_time, tz), end: zonedToUtc(date, e.end_time, tz) };
      if (e.kind === 'extra') windows.push(w);
      else busy.push(w); // part of the day off
    }

    for (const w of windows) {
      for (let s = w.start; s + durationMs <= w.end; s += STEP_MIN * 60_000) {
        const slot = { start: s, end: s + durationMs };
        if (s < earliest) continue;
        if (busy.some((b) => overlaps(slot, b))) continue;
        if (slots.some((x) => x.start === new Date(s).toISOString())) continue; // overlapping windows
        slots.push({ start: new Date(s).toISOString(), end: new Date(slot.end).toISOString() });
      }
    }
  }

  slots.sort((a, b) => a.start.localeCompare(b.start));
  return { timezone: tz, slots };
}
