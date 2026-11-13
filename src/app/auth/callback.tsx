import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { finishGoogleSignIn } from '@/lib/google';

// Website only: Google sends the browser back here after an instructor
// signs in. We swap the code for a session and save calendar access.
// The app picks up the new session through the auth listener.
// A code can only be used once, so remember which ones are in progress.
const started = new Set<string>();

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(params.error_description ?? null);

  useEffect(() => {
    const code = params.code;
    if (!code || started.has(code)) return;
    started.add(code);
    finishGoogleSignIn(code)
      .then(() => setDone(true))
      .catch((e) => setError(e instanceof Error ? e.message : 'Google sign-in failed.'));
  }, [params.code]);

  if (error) {
    return (
      <Screen>
        <Title>Sign-in problem</Title>
        <ErrorText message={error} />
        <Button label="Back to sign in" onPress={() => setDone(true)} />
      </Screen>
    );
  }
  if (done || !params.code) return <Redirect href="/" />;
  return <Loading />;
}
