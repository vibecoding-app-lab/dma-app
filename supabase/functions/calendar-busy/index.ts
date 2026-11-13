// Returns busy times from the signed-in instructor's Google Calendar.
import { googleAccessToken, handle, HttpError, json, requireInstructor } from '../_shared/google.ts';

Deno.serve(
  handle(async (req) => {
    const { user, admin } = await requireInstructor(req);
    const { days = 7 } = await req.json().catch(() => ({}));
    const span = Math.min(Math.max(Number(days) || 7, 1), 60);

    const [{ data: tokenRow }, { data: instructor }] = await Promise.all([
      admin.from('instructor_google_tokens').select('refresh_token').eq('instructor_id', user.id).single(),
      admin.from('instructors').select('google_calendar_id, timezone').eq('profile_id', user.id).single(),
    ]);
    if (!tokenRow) throw new HttpError(409, 'Google Calendar is not connected');

    const accessToken = await googleAccessToken(tokenRow.refresh_token);
    const calendarId = instructor?.google_calendar_id ?? 'primary';
    const timeMin = new Date();
    const timeMax = new Date(timeMin.getTime() + span * 24 * 60 * 60 * 1000);

    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: instructor?.timezone ?? 'UTC',
        items: [{ id: calendarId }],
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new HttpError(502, body.error?.message ?? 'Google Calendar request failed');

    return json({ busy: body.calendars?.[calendarId]?.busy ?? [] });
  }),
);
