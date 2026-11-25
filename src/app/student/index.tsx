import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { LessonStatePill } from '@/components/LessonStatePill';
import { ProgressCard } from '@/components/ProgressCard';
import { RemarksLink } from '@/components/Remarks';
import { RoadTestCard, roadTestStillAhead } from '@/components/RoadTestCard';
import { Updates } from '@/components/Updates';
import { Logo } from '@/components/Logo';
import { Button, Card, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { type Booking, bookingAction, lessonLabel, proposal, studentCanCancel } from '@/lib/booking';
import { confirmAction, notify } from '@/lib/notify';
import { lessonState, packageLabel, totalLessons } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import type { Profile, RoadTest } from '@/lib/types';


export default function StudentHome() {
  const { profile, refreshProfile } = useAuth();
  const [instructor, setInstructor] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<Booking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roadTest, setRoadTest] = useState<RoadTest | null>(null);

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
    const { data: test } = await supabase.from('road_tests').select('*').eq('student_id', profile.id).maybeSingle();
    setRoadTest((test as RoadTest | null) ?? null);
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

  function lessonRow(b: Booking, i: number) {
    const open = () => router.push(`/student/lesson/${b.id}`);
    return (
      <View key={b.id} style={{ gap: 6, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
        <Text
          onPress={open}
          style={{ fontSize: 16, fontWeight: '600', textDecorationLine: proposal(b) ? 'line-through' : 'none', color: proposal(b) ? colors.muted : colors.ink }}>
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
          <LessonStatePill lesson={b} />
        )}
        {b.pickup_location ? <Subtitle>Pickup: {b.pickup_location}</Subtitle> : null}
        <RemarksLink lesson={b} onPress={open} />
        {proposal(b) || lessonState(b) === 'in_progress' ? null : studentCanCancel(b) ? (
          <Button label="Cancel lesson" variant="secondary" onPress={() => cancel(b)} loading={busyId === b.id} />
        ) : (
          <Subtitle>Less than 24 hours away. To cancel, please call your instructor.</Subtitle>
        )}
      </View>
    );
  }

  const now = Date.now();
  const upcoming = lessons.filter((b) => Date.parse(b.ends_at) > now && b.status !== 'cancelled' && b.status !== 'declined');
  const other = lessons.filter((b) => !upcoming.includes(b)).reverse().slice(0, 30);
  const nowLessons = upcoming.filter((b) => lessonState(b) === 'in_progress');
  const waiting = upcoming.filter((b) => !nowLessons.includes(b) && (b.status === 'pending' || proposal(b)));
  const confirmed = upcoming.filter((b) => !nowLessons.includes(b) && !waiting.includes(b));
  const counted = lessons.filter((b) => ['pending', 'confirmed', 'completed'].includes(b.status));

  return (
    <Screen>
      <Logo width={180} />
      <Title>Hi {profile?.full_name?.split(' ')[0] ?? 'there'}</Title>
      {profile?.username ? <Subtitle>@{profile.username}</Subtitle> : null}

      {roadTest && roadTestStillAhead(roadTest) ? <RoadTestCard test={roadTest} /> : null}

      <Updates onChange={loadLessons} lessonPath="/student/lesson" />

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
        <ProgressCard
          bookings={counted}
          onSelect={(kind) => router.push(kind === 'left' ? '/student/book' : `/student/lessons?show=${kind}`)}
          total={totalLessons(profile)}
          packageText={totalLessons(profile) ? packageLabel(profile?.package, profile?.lessons_total, profile?.extra_lessons ?? 0) : 'Your instructor will set your package.'}
        />
      ) : null}

      {nowLessons.length ? (
        <Card>
          <SectionLabel>LESSON IN PROGRESS</SectionLabel>
          {nowLessons.map(lessonRow)}
        </Card>
      ) : null}

      {waiting.length ? (
        <Card>
          <SectionLabel>WAITING FOR AN ANSWER</SectionLabel>
          {waiting.map(lessonRow)}
        </Card>
      ) : null}

      <Card>
        <SectionLabel>UPCOMING LESSONS</SectionLabel>
        {confirmed.length === 0 ? <Subtitle>No confirmed lessons coming up.</Subtitle> : null}
        {confirmed.map(lessonRow)}
      </Card>

      {other.length > 0 ? (
        <Card>
          <SectionLabel>PAST LESSONS AND REMARKS</SectionLabel>
          {other.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => router.push(`/student/lesson/${b.id}`)}
              style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{lessonLabel(b)}</Text>
              <LessonStatePill lesson={b} />
              <RemarksLink lesson={b} onPress={() => router.push(`/student/lesson/${b.id}`)} />
            </Pressable>
          ))}
        </Card>
      ) : null}

    </Screen>
  );
}
