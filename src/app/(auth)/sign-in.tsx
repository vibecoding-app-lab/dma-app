import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { Button, Card, ErrorText, Field, Screen, Subtitle, Title, colors } from '@/components/ui';
import { signInWithGoogleCalendar } from '@/lib/google';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import {
  cleanUsername,
  isValidUsername,
  signInWithUsername,
  USERNAME_RULES,
  usernameAvailable,
} from '@/lib/username';

type Mode = 'sign-in' | 'sign-up';

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [login, setLogin] = useState(''); // email or username when signing in
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Errors also pop up, so they can't be missed below the fold.
  function showError(message: string) {
    setError(message);
    notify('Sign-in problem', message);
  }

  async function signIn() {
    const value = login.trim();
    if (!value || !password) {
      showError('Enter your email or username, and your password.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (value.includes('@')) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: value.toLowerCase(),
          password,
        });
        if (authError) {
          throw new Error(
            authError.message === 'Invalid login credentials' ? 'Wrong email or password.' : authError.message,
          );
        }
      } else {
        await signInWithUsername(value, password);
      }
      router.replace('/');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) return showError('Enter a valid email address.');
    if (!isValidUsername(username)) return showError(`Usernames are ${USERNAME_RULES}`);
    if (password.length < 8) return showError('Password must be at least 8 characters.');

    setError(null);
    setBusy(true);
    try {
      if (!(await usernameAvailable(username))) {
        throw new Error('That username is taken. Please choose another.');
      }
      const { data, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { username: cleanUsername(username) } },
      });
      if (authError) throw authError;
      if (!data.session) {
        notify('Almost there', 'Account created. Check your email to confirm it, then sign in.');
        setMode('sign-in');
        return;
      }
      router.replace('/');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  }

  async function instructorSignIn() {
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogleCalendar();
      router.replace('/');
    } catch (e) {
      await supabase.auth.signOut();
      showError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setGoogleBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <Screen>
      <View style={{ gap: 6, marginTop: 24 }}>
        <Logo width={260} style={{ alignSelf: 'center', marginBottom: 12 }} />
        <Title>Book your driving lessons</Title>
        <Subtitle>Students sign in with their username or email. Instructors sign in with Google.</Subtitle>
      </View>

      <Card>
        <Text style={{ fontSize: 17, fontWeight: '600' }}>
          {mode === 'sign-in' ? "I'm a student" : 'Create a student account'}
        </Text>

        {mode === 'sign-in' ? (
          <Field
            label="Email or username"
            value={login}
            onChangeText={setLogin}
            placeholder="you@example.com or yourname"
            autoCapitalize="none"
            autoComplete="username"
          />
        ) : (
          <>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. sara_k"
              autoCapitalize="none"
              autoComplete="username-new"
            />
            <Text style={{ fontSize: 13, color: colors.muted }}>{USERNAME_RULES}</Text>
          </>
        )}

        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete={mode === 'sign-in' ? 'password' : 'password-new'}
        />

        {mode === 'sign-in' ? (
          <Button label="Sign in" onPress={signIn} loading={busy} />
        ) : (
          <Button label="Create account" onPress={signUp} loading={busy} />
        )}

        <Pressable onPress={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} style={{ paddingVertical: 6 }}>
          <Text style={{ color: colors.brand, fontSize: 15, textAlign: 'center' }}>
            {mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={{ fontSize: 17, fontWeight: '600' }}>I'm an instructor</Text>
        <Subtitle>Connects your Google Calendar so students only see times you're free.</Subtitle>
        <Button label="Sign in with Google" variant="secondary" onPress={instructorSignIn} loading={googleBusy} />
      </Card>

      <ErrorText message={error} />
    </Screen>
  );
}
