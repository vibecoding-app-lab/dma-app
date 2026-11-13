import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { ProgressCard } from '@/components/ProgressCard';
import { Updates } from '@/components/Updates';
import { Button, Card, Pill, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { type Booking, STATUS_LABEL, bookingAction, lessonLabel, proposal, studentCanCancel } from '@/lib/booking';
import { unreadCounts } from '@/lib/chat';
import { confirmAction, notify } from '@/lib/notify';
import { packageLabel } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const TONE = { pending: 'waiting', confirmed: 'good', declined: 'bad', cancelled: 'neutral', completed: 'good' } as const;

export default function StudentHome() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [instructor, setInstructor] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<Booking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

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
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('student_id', profile.id)
      .order('starts_at');
    setLessons((data as Booking[]) ?? []);
    const counts = await unreadCounts(profile.id);
    setUnread(Object.values(counts).reduce((a, b) => a + b, 0));
    refreshProfile();
  }, [profile]);


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

  async function answer(b: Booking, action: 'accept_proposal' | 'decline_proposal') {
    setBusyId(b.id + action);
    try {
      const updated = await bookingAction({ action, booking_id: b.id });
      await loadLessons();
      notify(
        action === 'accept_proposal' ? 'Lesson confirmed' : 'New time declined',
        action === 'accept_proposal'
          ? lessonLabel(updated)
          : b.status === 'pending'
            ? 'Your instructor has been told. You can book another time.'
            : `Your instructor has been told. Your lesson stays on ${lessonLabel(b)}.`,
      );
    } catch (e) {
      notify('Something went wrong', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  const now = Date.now();
  const upcoming = lessons.filter((b) => Date.parse(b.ends_at) > now && b.status !== 'cancelled' && b.status !== 'declined');
  const other = lessons.filter((b) => !upcoming.includes(b)).reverse().slice(0, 30);
  const counted = lessons.filter((b) => ['pending', 'confirmed', 'completed'].includes(b.status));

  return (
    <Screen>
      <Title>Hi {profile?.full_name?.split(' ')[0] ?? 'there'}</Title>
      {profile?.username ? <Subtitle>@{profile.username}</Subtitle> : null}

      <Updates onChange={loadLessons} />

      <Card>
        <SectionLabel>MY INSTRUCTOR</SectionLabel>
        {instructor ? (
          <>
            <Text style={{ fontSize: 20, fontWeight: '600' }}>{instructor.full_name ?? instructor.email}</Text>
            {instructor.username ? <Text style={{ fontSize: 15, color: colors.muted }}>@{instructor.username}</Text> : null}
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

      {instructor ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label="Book a lesson" onPress={() => router.push('/student/book')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={unread ? `Chat (${unread} new)` : 'Chat'}
              variant="secondary"
              onPress={() => router.push('/student/chat')}
            />
          </View>
        </View>
      ) : null}

      {instructor ? (
        <ProgressCard
          bookings={counted}
          total={profile?.lessons_total ?? null}
          packageText={profile?.package ? packageLabel(profile.package, profile.lessons_total) : 'Your instructor will set your package.'}
        />
      ) : null}

      <Card>
        <SectionLabel>MY LESSONS</SectionLabel>
        {upcoming.length === 0 ? <Subtitle>No upcoming lessons.</Subtitle> : null}
        {upcoming.map((b) => (
          <View key={b.id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '600', textDecorationLine: proposal(b) ? 'line-through' : 'none', color: proposal(b) ? colors.muted : colors.ink }}>
              {lessonLabel(b)}
            </Text>
            {proposal(b) ? (
              <View style={{ gap: 8, backgroundColor: '#FFF4D6', borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#8A5A00' }}>YOUR INSTRUCTOR SUGGESTED A NEW TIME</Text>
                <Text style={{ fontSize: 16, fontWeight: '700' }}>{lessonLabel(proposal(b)!)}</Text>
                {b.proposal_message ? (
                  <Text style={{ fontSize: 15, fontStyle: 'italic' }}>"{b.proposal_message}"</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button label="Accept" onPress={() => answer(b, 'accept_proposal')} loading={busyId === b.id + 'accept_proposal'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Decline" variant="secondary" onPress={() => answer(b, 'decline_proposal')} loading={busyId === b.id + 'decline_proposal'} />
                  </View>
                </View>
              </View>
            ) : (
              <Pill label={STATUS_LABEL[b.status]} tone={TONE[b.status]} />
            )}
            {b.pickup_location ? <Subtitle>Pickup: {b.pickup_location}</Subtitle> : null}
            {proposal(b) ? null : studentCanCancel(b) ? (
              <Button label="Cancel lesson" variant="secondary" onPress={() => cancel(b)} loading={busyId === b.id} />
            ) : (
              <Subtitle>Less than 24 hours away. To cancel, please call your instructor.</Subtitle>
            )}
          </View>
        ))}
      </Card>

      {other.length > 0 ? (
        <Card>
          <SectionLabel>PAST LESSONS AND REMARKS</SectionLabel>
          {other.map((b) => (
            <View key={b.id} style={{ gap: 4, paddingVertical: 6 }}>
              <Text style={{ fontSize: 15 }}>{lessonLabel(b)}</Text>
              <Pill label={Date.parse(b.ends_at) < now && b.status === 'confirmed' ? 'Done' : STATUS_LABEL[b.status]} tone={TONE[b.status]} />
              {b.remarks ? (
                <View style={{ backgroundColor: '#F3F7FF', borderRadius: 10, padding: 10, gap: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#174EA6' }}>INSTRUCTOR'S REMARKS</Text>
                  <Text style={{ fontSize: 15 }}>{b.remarks}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
