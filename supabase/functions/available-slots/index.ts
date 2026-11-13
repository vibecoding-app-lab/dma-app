// Open lesson slots. Students get their assigned instructor's; instructors get their own.
import { handle, HttpError, json, requireUser } from '../_shared/google.ts';
import { openSlots } from '../_shared/slots.ts';

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

    return json(await openSlots(admin, instructorId, durationHours, days, excludeBookingId));
  }),
);
