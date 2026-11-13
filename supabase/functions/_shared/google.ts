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

/** The signed-in user making the request, and whether they are an instructor. */
export async function requireInstructor(req: Request): Promise<{ user: User; admin: SupabaseClient }> {
  const admin = adminClient();
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Not signed in');

  const { data: profile } = await admin.from('profiles').select('role').eq('id', data.user.id).single();
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    throw new HttpError(403, 'This Google account is not registered as a Drive Master Academy instructor.');
  }
  return { user: data.user, admin };
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
