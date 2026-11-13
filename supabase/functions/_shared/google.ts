import { createClient, type SupabaseClient, type User } from 'jsr:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Service-role client: bypasses RLS, server only. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

export type CallerProfile = {
  id: string;
  role: 'student' | 'instructor' | 'admin';
  full_name: string | null;
  assigned_instructor_id: string | null;
};

/** The signed-in user making the request, with their profile. */
export async function requireUser(
  req: Request,
): Promise<{ user: User; admin: SupabaseClient; profile: CallerProfile }> {
  const admin = adminClient();
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Not signed in');

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, full_name, assigned_instructor_id')
    .eq('id', data.user.id)
    .single();
  if (!profile) throw new HttpError(403, 'No profile found for this account');
  return { user: data.user, admin, profile };
}

/** Like requireUser, but only instructors (and admins) get through. */
export async function requireInstructor(req: Request) {
  const caller = await requireUser(req);
  if (caller.profile.role !== 'instructor' && caller.profile.role !== 'admin') {
    throw new HttpError(403, 'This Google account is not registered as a Drive Master Academy instructor.');
  }
  return caller;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Exchanges a stored refresh token for a short-lived Google access token. */
export async function googleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new HttpError(409, `Google Calendar needs reconnecting (${body.error ?? res.status})`);
  }
  return body.access_token as string;
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Unexpected error' }, 500);
    }
  };
}

export type CalendarEvent = {
  id: string;
  summary: string;
  start: number;
  end: number;
  allDay: boolean;
  busy: boolean;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  status?: string;
  transparency?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
};

/**
 * Events on an instructor's calendar between two instants. All-day dates are
 * placed in the instructor's time zone. "busy" mirrors Google's free/busy rules:
 * events marked Free, cancelled, or declined by the instructor don't block time.
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: number,
  timeMax: number,
  zonedToUtc: (date: string, time: string, tz: string) => number,
  timeZone: string,
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const body = await res.json();
    if (!res.ok) throw new HttpError(502, body.error?.message ?? 'Google Calendar request failed');

    for (const e of (body.items ?? []) as GoogleEvent[]) {
      if (e.status === 'cancelled') continue;
      const allDay = !e.start.dateTime;
      const start = allDay ? zonedToUtc(e.start.date!, '00:00', timeZone) : Date.parse(e.start.dateTime!);
      const end = allDay ? zonedToUtc(e.end.date!, '00:00', timeZone) : Date.parse(e.end.dateTime!);
      const declined = e.attendees?.some((a) => a.self && a.responseStatus === 'declined') ?? false;
      events.push({
        id: e.id,
        summary: e.summary ?? '(No title)',
        start,
        end,
        allDay,
        busy: e.transparency !== 'transparent' && !declined,
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return events;
}

/** Creates, updates or deletes a single event on the instructor's calendar. */
export async function googleEventRequest(
  accessToken: string,
  calendarId: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  eventId: string | null,
  body?: unknown,
): Promise<{ id?: string } | null> {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await fetch(eventId ? `${base}/${encodeURIComponent(eventId)}` : base, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'DELETE') {
    // Already gone is fine.
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new HttpError(502, 'Could not remove the lesson from Google Calendar');
    }
    return null;
  }
  const json = await res.json();
  if (!res.ok) throw new HttpError(502, json.error?.message ?? 'Could not update Google Calendar');
  return json;
}

/** Access token for an instructor, or null when their calendar isn't connected. */
export async function instructorAccessToken(admin: SupabaseClient, instructorId: string): Promise<string | null> {
  const { data } = await admin
    .from('instructor_google_tokens')
    .select('refresh_token')
    .eq('instructor_id', instructorId)
    .maybeSingle();
  if (!data) return null;
  return await googleAccessToken(data.refresh_token);
}
