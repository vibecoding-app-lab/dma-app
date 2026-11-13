import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { Button, Card, Pill, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { type Booking, STATUS_LABEL, bookingAction, lessonLabel, studentCanCancel } from '@/lib/booking';
import { confirmAction, notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const TONE = { pending: 'waiting', confirmed: 'good', declined: 'bad', cancelled: 'neutral', completed: 'neutral' } as const;

export default function StudentHome() {
  const { profile, signOut } = useAuth();
  const [instructor, setInstructor] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<Booking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.assigned_instructor_id) {
      setInstructor(null);
      return;
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.assigned_instructor_id)
      .single()
      .then(({ data }) => setInstructor(data ?? null));
  }, [profile?.assigned_instructor_id]);

  const loadLessons = useCallback(async () => {
    if (!profile) return;
    const since = new Date(Date.now() - 14 * 24 * 3_600_000).toISOString();
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('student_id', profile.id)
      .gte('starts_at', since)
      .order('starts_at');
    setLessons((data as Booking[]) ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadLessons();
    }, [loadLessons]),
  );

  function cancel(b: Booking) {
    confirmAction('Cancel this lesson?', lessonLabel(b), 'Cancel lesson', async () => {
      setBusyId(b.id);
      try {
        await bookingAction({ action: 'cancel', booking_id: b.id });
        await loadLessons();
      } catch (e) {
        notify('Could not cancel', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setBusyId(null);
      }
    });
  }

  const now = Date.now();
  const upcoming = lessons.filter((b) => Date.parse(b.ends_at) > now && b.status !== 'cancelled' && b.status !== 'declined');
  const other = lessons.filter((b) => !upcoming.includes(b)).reverse();

  return (
    <Screen>
      <Title>Hi {profile?.full_name?.split(' ')[0] ?? 'there'}</Title>

      <Card>
        <SectionLabel>MY INSTRUCTOR</SectionLabel>
        {instructor ? (
          <>
            <Text style={{ fontSize: 20, fontWeight: '600' }}>{instructor.full_name ?? instructor.email}</Text>
            {instructor.phone ? (
              <Button
                label={`Call ${instructor.phone}`}
                variant="secondary"
                onPress={() => Linking.openURL(`tel:${instructor.phone}`)}
              />
            ) : null}
          </>
        ) : (
          <Subtitle>
            You haven't been assigned an instructor yet. Drive Master Academy will assign one to you shortly.
          </Subtitle>
        )}
      </Card>

      {instructor ? <Button label="Book a lesson" onPress={() => router.push('/student/book')} /> : null}

      <Card>
        <SectionLabel>MY LESSONS</SectionLabel>
        {upcoming.length === 0 ? <Subtitle>No upcoming lessons.</Subtitle> : null}
        {upcoming.map((b) => (
          <View key={b.id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{lessonLabel(b)}</Text>
            <Pill label={STATUS_LABEL[b.status]} tone={TONE[b.status]} />
            {b.pickup_location ? <Subtitle>Pickup: {b.pickup_location}</Subtitle> : null}
            {studentCanCancel(b) ? (
              <Button label="Cancel lesson" variant="secondary" onPress={() => cancel(b)} loading={busyId === b.id} />
            ) : (
              <Subtitle>Less than 24 hours away. To cancel, please call your instructor.</Subtitle>
            )}
          </View>
        ))}
      </Card>

      {other.length > 0 ? (
        <Card>
          <SectionLabel>EARLIER AND CANCELLED</SectionLabel>
          {other.map((b) => (
            <View key={b.id} style={{ gap: 4, paddingVertical: 6 }}>
              <Text style={{ fontSize: 15 }}>{lessonLabel(b)}</Text>
              <Pill label={Date.parse(b.ends_at) < now && b.status === 'confirmed' ? 'Done' : STATUS_LABEL[b.status]} tone={TONE[b.status]} />
            </View>
          ))}
        </Card>
      ) : null}

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
