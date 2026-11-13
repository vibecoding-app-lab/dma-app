import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Button, Card, ErrorText, Pill, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  type Booking,
  type CalendarEvent,
  bookingAction,
  dayLabel,
  fetchCalendarEvents,
  lessonLabel,
  timeLabel,
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
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setLessons((bookings as Booking[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function showCalendar() {
    setLoadingEvents(true);
    setError(null);
    try {
      setEvents(await fetchCalendarEvents(7));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read your calendar.');
    } finally {
      setLoadingEvents(false);
    }
  }

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

  // Calendar events grouped by day.
  const eventDays = new Map<string, CalendarEvent[]>();
  for (const e of events ?? []) {
    const key = dayLabel(e.start);
    eventDays.set(key, [...(eventDays.get(key) ?? []), e]);
  }

  return (
    <Screen>
      <Title>Hi {profile?.full_name?.split(' ')[0] ?? 'there'}</Title>

      {!connected ? (
        <Card>
          <SectionLabel>GOOGLE CALENDAR</SectionLabel>
          <Subtitle>Connect your calendar so students only see times you are free.</Subtitle>
          <Button label="Connect Google Calendar" onPress={reconnect} loading={reconnecting} />
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
            <Text style={{ fontSize: 15 }}>{lessonLabel(b)}</Text>
            {b.pickup_location ? <Subtitle>Pickup: {b.pickup_location}</Subtitle> : null}
            {b.notes ? <Subtitle>Note: {b.notes}</Subtitle> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label="Accept" onPress={() => answer(b, 'accept')} loading={busyId === b.id + 'accept'} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Decline" variant="secondary" onPress={() => decline(b)} loading={busyId === b.id + 'decline'} />
              </View>
            </View>
            <Pressable onPress={() => router.push(`/instructor/lesson/${b.id}`)}>
              <Text style={{ color: colors.brand, fontWeight: '600' }}>Suggest a different time</Text>
            </Pressable>
          </View>
        ))}
      </Card>

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

      {connected ? (
        <Card>
          <SectionLabel>MY CALENDAR, NEXT 7 DAYS</SectionLabel>
          {!events ? (
            <Button label="Show my calendar" variant="secondary" onPress={showCalendar} loading={loadingEvents} />
          ) : events.length === 0 ? (
            <Subtitle>Nothing on your calendar in the next 7 days.</Subtitle>
          ) : (
            [...eventDays.entries()].map(([day, list]) => (
              <View key={day} style={{ gap: 2, paddingVertical: 6 }}>
                <Text style={{ fontSize: 15, fontWeight: '700' }}>{day}</Text>
                {list.map((e) => (
                  <Text key={e.id} style={{ fontSize: 15, color: e.busy ? colors.ink : colors.muted }}>
                    {e.allDay ? 'All day' : `${timeLabel(e.start)} to ${timeLabel(e.end)}`}  {e.summary}
                    {e.busy ? '' : ' (free)'}
                  </Text>
                ))}
              </View>
            ))
          )}
        </Card>
      ) : null}

      <Card>
        <SectionLabel>SETTINGS</SectionLabel>
        <Button label="Working hours" variant="secondary" onPress={() => router.push('/instructor/hours')} />
        <Button label="My students" variant="secondary" onPress={() => router.push('/instructor/students')} />
      </Card>

      <ErrorText message={error} />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
