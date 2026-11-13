import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, ErrorText, Screen, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fetchCalendarBusy, signInWithGoogleCalendar } from '@/lib/google';
import { supabase } from '@/lib/supabase';
import type { BusyBlock, Instructor } from '@/lib/types';

function formatBlock(block: BusyBlock) {
  const start = new Date(block.start);
  const end = new Date(block.end);
  const day = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time(start)} to ${time(end)}`;
}

export default function InstructorHome() {
  const { profile, signOut } = useAuth();
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [busy, setBusy] = useState<BusyBlock[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInstructor = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('instructors').select('*').eq('profile_id', profile.id).single();
    setInstructor(data ?? null);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadInstructor();
    }, [loadInstructor]),
  );

  async function checkCalendar() {
    setChecking(true);
    setError(null);
    try {
      setBusy(await fetchCalendarBusy(7));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read your calendar.');
    } finally {
      setChecking(false);
    }
  }

  async function reconnect() {
    setReconnecting(true);
    setError(null);
    try {
      await signInWithGoogleCalendar();
      await loadInstructor();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect Google Calendar.');
    } finally {
      setReconnecting(false);
    }
  }

  const connected = Boolean(instructor?.google_connected_at);

  return (
    <Screen>
      <Title>Hi {profile?.full_name?.split(' ')[0] ?? 'there'}</Title>

      <Card>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>GOOGLE CALENDAR</Text>
        <Text style={{ fontSize: 17, fontWeight: '600', color: connected ? colors.success : colors.brandDark }}>
          {connected ? 'Connected' : 'Not connected'}
        </Text>
        <Subtitle>
          {connected
            ? 'Students will not be offered times that are busy on your calendar.'
            : 'Connect your calendar so students only see times you are free.'}
        </Subtitle>
        {connected ? (
          <Button label="Show my busy times this week" variant="secondary" onPress={checkCalendar} loading={checking} />
        ) : (
          <Button label="Connect Google Calendar" onPress={reconnect} loading={reconnecting} />
        )}
        {busy ? (
          <View style={{ gap: 4, marginTop: 4 }}>
            {busy.length === 0 ? (
              <Subtitle>Nothing busy in the next 7 days.</Subtitle>
            ) : (
              busy.map((block) => (
                <Text key={block.start} style={{ fontSize: 15 }}>
                  {formatBlock(block)}
                </Text>
              ))
            )}
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={{ fontSize: 17, fontWeight: '600' }}>My students</Text>
        <Subtitle>Add the students you teach so they can book with you.</Subtitle>
        <Button label="Manage students" variant="secondary" onPress={() => router.push('/instructor/students')} />
      </Card>

      <Card>
        <Text style={{ fontSize: 17, fontWeight: '600' }}>Lesson requests</Text>
        <Subtitle>Accepting, editing and cancelling lessons is coming in the next update.</Subtitle>
      </Card>

      <ErrorText message={error} />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
