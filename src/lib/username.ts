import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';

export const USERNAME_RULES = '3 to 20 characters: letters, numbers, dots or underscores.';

export function cleanUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return /^[a-z0-9_.]{3,20}$/.test(cleanUsername(value));
}

export async function usernameAvailable(value: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', { p_username: cleanUsername(value) });
  if (error) throw error;
  return Boolean(data);
}

/** Signs in with username + password through the server, then stores the session. */
export async function signInWithUsername(username: string, password: string) {
  const { data, error } = await supabase.functions.invoke<{ access_token: string; refresh_token: string }>(
    'username-sign-in',
    { body: { username: cleanUsername(username), password } },
  );
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      throw new Error(body?.error ?? 'Could not sign in');
    }
    throw error;
  }
  if (!data) throw new Error('Could not sign in');
  const { error: sessionError } = await supabase.auth.setSession(data);
  if (sessionError) throw sessionError;
}
