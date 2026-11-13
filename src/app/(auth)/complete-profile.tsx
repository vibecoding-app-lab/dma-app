import { router } from 'expo-router';
import { useState } from 'react';

import { Button, ErrorText, Field, Screen, Subtitle, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { cleanUsername, isValidUsername, USERNAME_RULES } from '@/lib/username';

export default function CompleteProfile() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const needsUsername = !profile?.username;
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!profile) return;
    if (!fullName.trim() || !phone.trim()) {
      setError('Please enter your name and phone number.');
      return;
    }
    if (needsUsername && !isValidUsername(username)) {
      setError(`Choose a username: ${USERNAME_RULES}`);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        ...(needsUsername ? { username: cleanUsername(username) } : {}),
      })
      .eq('id', profile.id);
    setBusy(false);
    if (saveError) {
      setError(
        saveError.code === '23505' ? 'That username is taken. Please choose another.' : saveError.message,
      );
      return;
    }
    await refreshProfile();
    router.replace('/');
  }

  return (
    <Screen>
      <Title>About you</Title>
      <Subtitle>Your instructor uses these to contact you about lessons.</Subtitle>
      <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
      {needsUsername ? (
        <>
          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="e.g. sara_k"
            autoCapitalize="none"
            autoComplete="username-new"
          />
          <Subtitle>You can sign in with this instead of your email. {USERNAME_RULES}</Subtitle>
        </>
      ) : null}
      <Button label="Continue" onPress={save} loading={busy} />
      <ErrorText message={error} />
    </Screen>
  );
}
