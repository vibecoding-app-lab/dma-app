import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { InstructorCalendar } from '@/components/InstructorCalendar';
import { StudentsDashboard } from '@/components/StudentsDashboard';
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
import { unreadCounts } from '@/lib/chat';
import { confirmAction, notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import type { Instructor } from '@/lib/types';

function studentName(b: Booking) {
  return b.student?.full_name ?? b.student?.email ?? 'Student';
}

export default function InstructorHome() {
  const { profile } = useAuth();
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [hasHours, setHasHours] = useState(true);
  const [lessons, setLessons] = useState<Booking[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [needRemarks, setNeedRemarks] = useState<Booking[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const lastSignature = useRef('');

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: inst }, { count }, { data: bookings }, { data: past }, counts] = await Promise.all([
      supabase.from('instructors').select('*').eq('profile_id', profile.id).single(),
      supabase.from('availability_rules').select('id', { count: 'exact', head: true }).eq('instructor_id', profile.id),
      supabase
        .from('bookings')
        .select('*, student:profiles!bookings_student_id_fkey(full_name, phone, email)')
        .eq('instructor_id', profile.id)
        .in('status', ['pending', 'confirmed'])
        .gte('ends_at', new Date().toISOString())
        .order('starts_at'),
      // Lessons in the last 30 days that started but have no remarks yet.
      supabase
        .from('bookings')
        .select('*, student:profiles!bookings_student_id_fkey(full_name, phone, email)')
        .eq('instructor_id', profile.id)
        .eq('status', 'confirmed')
        .is('remarks', null)
        .lte('starts_at', new Date().toISOString())
        .gte('starts_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
        .order('starts_at', { ascending: false }),
      unreadCounts(profile.id),
    ]);
    setNeedRemarks((past as Booking[]) ?? []);
    setUnread(counts);
    const ids = Object.keys(counts);
    if (ids.length) {
      const { data: people } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      setNames(Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name ?? p.email])));
    }
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
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const requests = lessons.filter((b) => b.status === 'pending');
  const confirmed = lessons.filter((b) => b.status === 'confirmed');

  return (
    <Screen>
      <Title>Hi {profile?.full_name?.split(' ')[0] ?? 'there'}</Title>
      {profile?.username ? <Subtitle>@{profile.username}</Subtitle> : null}

      <Updates onChange={load} lessonPath="/instructor/lesson" />

      <StudentsDashboard />

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

      {totalUnread ? (
        <Card>
          <SectionLabel>NEW MESSAGES</SectionLabel>
          {Object.entries(unread).map(([studentId, n]) => (
            <Pressable
              key={studentId}
              onPress={() => router.push(`/instructor/chat/${studentId}`)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600' }}>
                {names[studentId] ?? 'A student'}
              </Text>
              <Text style={{ color: colors.brand, fontWeight: '700' }}>
                {n} new ›
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {needRemarks.length ? (
        <Card>
          <SectionLabel>ADD REMARKS ({needRemarks.length})</SectionLabel>
          <Subtitle>These lessons are over. Tell the student how it went.</Subtitle>
          {needRemarks.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => router.push(`/instructor/lesson/${b.id}`)}
              style={{ paddingVertical: 6, borderTopWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{studentName(b)}</Text>
              <Text style={{ fontSize: 14 }}>{lessonLabel(b)}</Text>
              <Text style={{ color: colors.brand, fontWeight: '600' }}>Add remarks ›</Text>
            </Pressable>
          ))}
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

      <ErrorText message={error} />
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
