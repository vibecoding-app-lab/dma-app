import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';

export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';

export type Booking = {
  id: string;
  student_id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  pickup_location: string | null;
  notes: string | null;
  google_event_id?: string | null;
  proposed_starts_at?: string | null;
  proposed_ends_at?: string | null;
  proposal_message?: string | null;
  remarks?: string | null;
  remarks_at?: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  student?: { full_name: string | null; phone: string | null; email: string } | null;
};

export type Slot = { start: string; end: string };

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  busy: boolean;
};

/** Calls an edge function and turns its { error } reply into a readable Error. */
async function call<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      const reply = await response.json().catch(() => null);
      throw new Error(reply?.error ?? `Server error (${response.status})`);
    }
    throw error;
  }
  return data as T;
}

export async function fetchSlots(durationHours: 1 | 2, excludeBookingId?: string, days = 21) {
  return call<{ timezone: string; slots: Slot[] }>('available-slots', {
    duration_hours: durationHours,
    days,
    exclude_booking_id: excludeBookingId ?? null,
  });
}

export async function fetchCalendarEvents(days = 7, from?: Date) {
  const { events } = await call<{ events: CalendarEvent[] }>('calendar-events', {
    days,
    from: from ? from.toISOString() : null,
  });
  return events;
}

type Action =
  | { action: 'request'; starts_at: string; duration_hours: 1 | 2; pickup_location?: string; notes?: string }
  | { action: 'accept'; booking_id: string }
  | { action: 'decline'; booking_id: string; reason?: string }
  | { action: 'cancel'; booking_id: string; reason?: string }
  | { action: 'reschedule'; booking_id: string; starts_at: string; duration_hours: 1 | 2; message?: string }
  | { action: 'remarks'; booking_id: string; remarks: string }
  | { action: 'accept_proposal'; booking_id: string }
  | { action: 'decline_proposal'; booking_id: string };

export async function bookingAction(input: Action): Promise<Booking> {
  const { booking } = await call<{ booking: Booking }>('booking-action', input);
  return booking;
}

// ---- Formatting -----------------------------------------------------------

export function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function lessonLabel(b: { starts_at: string; ends_at: string }) {
  const hours = Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 3_600_000);
  return `${dayLabel(b.starts_at)}, ${timeLabel(b.starts_at)} to ${timeLabel(b.ends_at)} (${hours} hour${hours === 1 ? '' : 's'})`;
}

export function lessonHours(b: { starts_at: string; ends_at: string }): 1 | 2 {
  return Date.parse(b.ends_at) - Date.parse(b.starts_at) > 3_600_000 ? 2 : 1;
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Waiting for instructor',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

/** A student may cancel a lesson that starts 24 hours or more from now. */
export function studentCanCancel(b: Booking) {
  return (b.status === 'pending' || b.status === 'confirmed') && Date.parse(b.starts_at) - Date.now() >= 24 * 3_600_000;
}

/** The new time an instructor suggested, if the student hasn't answered yet. */
export function proposal(b: Booking): { starts_at: string; ends_at: string } | null {
  return b.proposed_starts_at && b.proposed_ends_at ? { starts_at: b.proposed_starts_at, ends_at: b.proposed_ends_at } : null;
}

// ---- Notifications ----------------------------------------------------------

export type AppNotification = { id: string; booking_id: string | null; message: string; created_at: string };

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('id, booking_id, message, created_at')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data as AppNotification[]) ?? [];
}

export async function dismissNotifications(ids: string[]) {
  if (!ids.length) return;
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
}

/** The server writes times as {t:ISO}; show them in the reader's own time. */
export function notificationText(message: string) {
  return message.replace(/\{t:([^}]+)\}/g, (_, iso: string) => `${dayLabel(iso)}, ${timeLabel(iso)}`);
}
