import { makeRedirectUri } from 'expo-auth-session';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';
import type { BusyBlock } from './types';

WebBrowser.maybeCompleteAuthSession();

/** Turns an edge function failure into the message the function sent back. */
async function functionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    try {
      const body = await response.json();
      if (body?.error) return new Error(`${body.error} (${response.status})`);
      if (body?.message) return new Error(`${body.message} (${response.status})`);
    } catch {
      // not JSON
    }
    return new Error(`Server error (${response.status})`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

// Read free/busy and manage the events this app creates.
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const redirectTo = makeRedirectUri({ scheme: 'dmaapp', path: 'auth/callback' });

/**
 * Instructor sign-in with Google. Asks for calendar access in the same step
 * and hands the Google refresh token to the server, so the app can read
 * busy times and write lessons to the instructor's calendar.
 */
export async function signInWithGoogleCalendar(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: CALENDAR_SCOPES,
      skipBrowserRedirect: true,
      // offline + consent makes Google return a refresh token every time.
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new Error('Google sign-in was cancelled');
  }

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Google sign-in did not return a code');

  const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;

  const refreshToken = exchanged.session?.provider_refresh_token;
  if (!refreshToken) {
    throw new Error('Google did not grant calendar access. Please try again and allow calendar access.');
  }

  const { error: saveError } = await supabase.functions.invoke('save-google-token', {
    body: {
      refresh_token: refreshToken,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  if (saveError) throw await functionError(saveError);
}

/** Busy times on the signed-in instructor's Google Calendar. */
export async function fetchCalendarBusy(days = 7): Promise<BusyBlock[]> {
  const { data, error } = await supabase.functions.invoke<{ busy: BusyBlock[] }>('calendar-busy', {
    body: { days },
  });
  if (error) throw await functionError(error);
  return data?.busy ?? [];
}
