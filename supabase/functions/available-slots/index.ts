// Open lesson slots. Students get their assigned instructor's; instructors get their own.
import { handle, HttpError, json, requireUser } from '../_shared/google.ts';
import { MAX_STUDENT_HOURS_PER_DAY, openSlots, studentHoursByDay } from '../_shared/slots.ts';
import { localDate } from '../_shared/time.ts';

Deno.serve(
  handle(async (req) => {
    const { admin, profile } = await requireUser(req);
    const body = await req.json().catch(() => ({}));

    const durationHours = Number(body.duration_hours);
    if (durationHours !== 1 && durationHours !== 2) throw new HttpError(400, 'duration_hours must be 1 or 2');
    const days = Math.min(Math.max(Number(body.days) || 14, 1), 31);
    const excludeBookingId: string | null = body.exclude_booking_id ?? null;

    const instructorId = profile.role === 'student' ? profile.assigned_instructor_id : profile.id;
    if (!instructorId) throw new HttpError(409, "You haven't been assigned an instructor yet");

    const result = await openSlots(admin, instructorId, durationHours, days, excludeBookingId);

    // Students: hide days where this lesson would go over the daily limit.
    if (profile.role === 'student') {
      const used = await studentHoursByDay(admin, profile.id, result.timezone);
      result.slots = result.slots.filter(
        (s) => (used.get(localDate(Date.parse(s.start), result.timezone).date) ?? 0) + durationHours <= MAX_STUDENT_HOURS_PER_DAY,
      );
    }
    return json(result);
  }),
);
