// Signs a student in with their username: finds the account's email on the
// server (so emails are never exposed) and returns a normal session.
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { adminClient, handle, HttpError, json } from '../_shared/google.ts';

const WRONG = 'Wrong username or password';

Deno.serve(
  handle(async (req) => {
    const { username, password } = await req.json().catch(() => ({}));
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      throw new HttpError(400, 'Enter your username and password');
    }

    const { data: profile } = await adminClient()
      .from('profiles')
      .select('email')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle();
    if (!profile) throw new HttpError(401, WRONG);

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email: profile.email, password });
    if (error || !data.session) throw new HttpError(401, WRONG);

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }),
);
