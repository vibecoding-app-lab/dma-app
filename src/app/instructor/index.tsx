import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { InstructorCalendar } from '@/components/InstructorCalendar';
import { Updates } from '@/components/Updates';
import { Button, Card, ErrorText, Pill, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  type Booking,
  bookingAction,
  lessonLabel,
  proposal,
} from '@/lib/booking';
import { signInWithGoogleCalendar } from '@/lib/google';
import { confirmAction, notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import type { Instructor } from '@/lib/types';

function studentName(b: Booking) {
  return b.student?.full_name ?? b.student?.email ?? 'Student';
}

export default function InstructorHome() {
  const { profile, signOut } = useAuth();
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [hasHours, setHasHours] = useState(true);
  const [lessons, setLessons] = useState<Booking[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastSignature = useRef('');

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: inst }, { count }, { data: bookings }] = await Promise.all([
      supabase.from('instructors').select('*').eq('profile_id', profile.id).single(),
      supabase.from('availability_rules').select('id', { count: 'exact', head: true }).eq('instructor_id', profile.id),
      supabase
        .from('bookings')
        .select('*, student:profiles!bookings_student_id_fkey(full_name, phone, email)')
        .eq('instructor_id', profile.id)
        .in('status', ['pending', 'confirmed'])
        .gte('ends_at', new Date().toISOString())
        .order('starts_at'),
    ]);
    setInstructor(inst ?? null);
    setHasHours((count ?? 0) > 0);
    const list = (bookings as Booking[]) ?? [];
    setLessons(list);
    // Redraw the calendar only when a lesson actually changed.
    const signature = JSON.stringify(list.map((b) => [b.id, b.status, b.starts_at, b.proposed_starts_at]));
    if (signature !== lastSignature.current) {
      lastSignature.current = signature;
      setRefreshKey((k) => k + 1);
    }
  }, [profile]);


  async function reconnect() {
    setReconnecting(true);
    setError(null);
    try {
      await signInWithGoogleCalendar();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect Google Calendar.');
    } finally {
      setReconnecting(false);
    }
  }

  async function answer(b: Booking, action: 'accept' | 'decline') {
    setBusyId(b.id + action);
    try {
      await bookingAction({ action, booking_id: b.id });
      await load();
      if (action === 'accept') notify('Lesson confirmed', `${studentName(b)}, ${lessonLabel(b)}. Added to your Google Calendar.`);
    } catch (e) {
      notify('Something went wrong', e instanceof Error ? e.message : 'Please try again.');
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function decline(b: Booking) {
    confirmAction('Decline this request?', `${studentName(b)}, ${lessonLabel(b)}`, 'Decline', () => answer(b, 'decline'));
  }

  const connected = Boolean(instructor?.google_connected_at);
  const requests = lessons.filter((b) => b.status === 'pending');
  const confirmed = lessons.filter((b) => b.status === 'confirmed');

  return (
    <Screen>
      <Title>Hi {profile?.full_name?.split(' ')[0] ?? 'there'}</Title>
      {profile?.username ? <Subtitle>@{profile.username}</Subtitle> : null}

      <Updates onChange={load} />

      {!connected ? (
        <Card>
          <SectionLabel>GOOGLE CALENDAR</SectionLabel>
          <Subtitle>Connect your calendar so students only see times you are free.</Subtitle>
          <Button label="Connect Google Calendar" onPress={reconnect} loading={reconnecting} />
        </Card>
      ) : null}

      {profile && !profile.username ? (
        <Card>
          <SectionLabel>USERNAME</SectionLabel>
          <Subtitle>Choose a username. Your students will see it next to your name.</Subtitle>
          <Button label="Choose a username" onPress={() => router.push('/instructor/profile')} />
        </Card>
      ) : null}

      {!hasHours ? (
        <Card>
          <SectionLabel>WORKING HOURS</SectionLabel>
          <Subtitle>Students can't book until you set the hours you teach.</Subtitle>
          <Button label="Set working hours" onPress={() => router.push('/instructor/hours')} />
        </Card>
      ) : null}

      <Card>
        <SectionLabel>LESSON REQUESTS ({requests.length})</SectionLabel>
        {requests.length === 0 ? <Subtitle>No requests waiting.</Subtitle> : null}
        {requests.map((b) => (
          <View key={b.id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{studentName(b)}</Text>
            <Text style={{ fontSize: 15, textDecorationLine: proposal(b) ? 'line-through' : 'none' }}>{lessonLabel(b)}</Text>
            {b.pickup_location ? <Subtitle>Pickup: {b.pickup_location}</Subtitle> : null}
            {b.notes ? <Subtitle>Note: {b.notes}</Subtitle> : null}
            {proposal(b) ? (
              <WaitingForStudent b={b} />
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Accept" onPress={() => answer(b, 'accept')} loading={busyId === b.id + 'accept'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Decline" variant="secondary" onPress={() => decline(b)} loading={busyId === b.id + 'decline'} />
                </View>
              </View>
            )}
            <Pressable onPress={() => router.push(`/instructor/lesson/${b.id}`)}>
              <Text style={{ color: colors.brand, fontWeight: '600' }}>
                {proposal(b) ? 'Change the suggested time' : 'Suggest a different time'}
              </Text>
            </Pressable>
          </View>
        ))}
      </Card>

      {profile ? (
        <Card>
          <InstructorCalendar instructorId={profile.id} refreshKey={refreshKey} />
        </Card>
      ) : null}

      <Card>
        <SectionLabel>UPCOMING LESSONS</SectionLabel>
        {confirmed.length === 0 ? <Subtitle>No confirmed lessons yet.</Subtitle> : null}
        {confirmed.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => router.push(`/instructor/lesson/${b.id}`)}
            style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{studentName(b)}</Text>
            <Text style={{ fontSize: 15 }}>{lessonLabel(b)}</Text>
            {proposal(b) ? <WaitingForStudent b={b} /> : null}
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Pill label="Confirmed" tone="good" />
              {b.student?.phone ? (
                <Text style={{ color: colors.brand }} onPress={() => Linking.openURL(`tel:${b.student?.phone}`)}>
                  Call
                </Text>
              ) : null}
              <Text style={{ color: colors.brand, fontWeight: '600' }}>Edit or cancel</Text>
            </View>
          </Pressable>
        ))}
      </Card>

      <Card>
        <SectionLabel>SETTINGS</SectionLabel>
        <Button label="My profile and username" variant="secondary" onPress={() => router.push('/instructor/profile')} />
        <Button label="Working hours" variant="secondary" onPress={() => router.push('/instructor/hours')} />
        <Button label="My students" variant="secondary" onPress={() => router.push('/instructor/students')} />
      </Card>

      <ErrorText message={error} />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

function WaitingForStudent({ b }: { b: Booking }) {
  const p = proposal(b);
  if (!p) return null;
  return (
    <View style={{ backgroundColor: '#FFF4D6', borderRadius: 10, padding: 10, gap: 2 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#8A5A00' }}>NEW TIME SENT, WAITING FOR STUDENT</Text>
      <Text style={{ fontSize: 15, fontWeight: '600' }}>{lessonLabel(p)}</Text>
      <Text style={{ fontSize: 13, color: colors.muted }}>Both times are kept free until the student answers.</Text>
    </View>
  );
}
