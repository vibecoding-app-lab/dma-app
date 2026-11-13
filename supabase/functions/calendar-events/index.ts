// The signed-in instructor's own calendar for the next few days, with titles.
// Only instructors can call this; students never see event details.
import { handle, HttpError, instructorAccessToken, json, listEvents, requireInstructor } from '../_shared/google.ts';
import { DAY, zonedToUtc } from '../_shared/time.ts';

Deno.serve(
  handle(async (req) => {
    const { admin, user } = await requireInstructor(req);
    const { days = 7, from } = await req.json().catch(() => ({}));
    const span = Math.min(Math.max(Number(days) || 7, 1), 31);
    // Optional start of the range (ISO time); defaults to now. Limited to
    // about two months either side of today.
    const requested = from ? Date.parse(String(from)) : NaN;
    const start = Number.isNaN(requested)
      ? Date.now()
      : Math.min(Math.max(requested, Date.now() - 62 * DAY), Date.now() + 62 * DAY);

    const { data: instructor } = await admin
      .from('instructors')
      .select('timezone, google_calendar_id')
      .eq('profile_id', user.id)
      .single();
    const accessToken = await instructorAccessToken(admin, user.id);
    if (!instructor || !accessToken) throw new HttpError(409, 'Google Calendar is not connected');

    const events = await listEvents(
      accessToken,
      instructor.google_calendar_id,
      start,
      start + span * DAY,
      zonedToUtc,
      instructor.timezone || 'UTC',
    );
    return json({
      events: events.map((e) => ({
        id: e.id,
        summary: e.summary,
        start: new Date(e.start).toISOString(),
        end: new Date(e.end).toISOString(),
        allDay: e.allDay,
        busy: e.busy,
      })),
    });
  }),
);
