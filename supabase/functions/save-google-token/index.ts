// Stores an instructor's Google refresh token after they sign in with Google.
import { handle, HttpError, json, requireInstructor } from '../_shared/google.ts';

Deno.serve(
  handle(async (req) => {
    const { user, admin } = await requireInstructor(req);
    const { refresh_token, timezone } = await req.json();
    if (typeof refresh_token !== 'string' || refresh_token.length < 10) {
      throw new HttpError(400, 'Missing refresh_token');
    }

    const { error: tokenError } = await admin
      .from('instructor_google_tokens')
      .upsert({ instructor_id: user.id, refresh_token, updated_at: new Date().toISOString() });
    if (tokenError) throw tokenError;

    const updates: Record<string, string> = { google_connected_at: new Date().toISOString() };
    if (typeof timezone === 'string' && timezone) updates.timezone = timezone;
    const { error: instructorError } = await admin.from('instructors').update(updates).eq('profile_id', user.id);
    if (instructorError) throw instructorError;

    // Fill in the instructor's name from Google if it is missing.
    const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
    if (name) {
      await admin.from('profiles').update({ full_name: name }).eq('id', user.id).is('full_name', null);
    }

    return json({ ok: true });
  }),
);
