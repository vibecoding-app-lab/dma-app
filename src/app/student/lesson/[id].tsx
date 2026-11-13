import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LessonStatePill } from '@/components/LessonStatePill';
import { RemarksView } from '@/components/Remarks';
import { Button, Card, Loading, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { type Booking, bookingAction, lessonLabel, proposal, studentCanCancel } from '@/lib/booking';
import { confirmAction, notify } from '@/lib/notify';
import { lessonState } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

/** One lesson for the student: time, status, a suggested new time, remarks. */
export default function StudentLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lesson, setLesson] = useState<Booking | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle();
    setMissing(!data);
    setLesson((data as Booking) ?? null);
  }, [id]);
  useLiveRefresh(load, 30_000);

  if (missing) {
    return (
      <Screen>
        <Title>Lesson not found</Title>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!lesson) return <Loading />;
  const p = proposal(lesson);
  const state = lessonState(lesson);
  const hasRemarks = Boolean(lesson.remarks || lesson.remarks_items?.length);

  async function act(action: 'accept_proposal' | 'decline_proposal' | 'cancel') {
    if (!lesson) return;
    setBusy(action);
    try {
      await bookingAction({ action, booking_id: lesson.id });
      await load();
    } catch (e) {
      notify('Something went wrong', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/student'))}>
        <Text style={{ color: colors.brand, fontSize: 16 }}>‹ Back</Text>
      </Pressable>
      <Title>Lesson</Title>

      <Card>
        <Text style={{ fontSize: 18, fontWeight: '700', textDecorationLine: p ? 'line-through' : 'none' }}>{lessonLabel(lesson)}</Text>
        <LessonStatePill lesson={lesson} />
        {lesson.pickup_location ? <Subtitle>Pickup: {lesson.pickup_location}</Subtitle> : null}
        {lesson.notes ? <Subtitle>Your note: {lesson.notes}</Subtitle> : null}
      </Card>

      {p ? (
        <View style={{ gap: 8, backgroundColor: '#FFF4D6', borderRadius: 12, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#8A5A00' }}>YOUR INSTRUCTOR SUGGESTED A NEW TIME</Text>
          <Text style={{ fontSize: 17, fontWeight: '700' }}>{lessonLabel(p)}</Text>
          {lesson.proposal_message ? <Text style={{ fontSize: 15, fontStyle: 'italic' }}>"{lesson.proposal_message}"</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label="Accept" onPress={() => act('accept_proposal')} loading={busy === 'accept_proposal'} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Decline" variant="secondary" onPress={() => act('decline_proposal')} loading={busy === 'decline_proposal'} />
            </View>
          </View>
        </View>
      ) : null}

      <Card>
        <SectionLabel>REMARKS FROM YOUR INSTRUCTOR</SectionLabel>
        {hasRemarks ? (
          <RemarksView lesson={lesson} />
        ) : (
          <Subtitle>
            {state === 'done' || state === 'in_progress'
              ? 'Your instructor hasn’t added remarks yet.'
              : 'Your instructor adds remarks after the lesson.'}
          </Subtitle>
        )}
      </Card>

      {!p && studentCanCancel(lesson) ? (
        <Button
          label="Cancel lesson"
          variant="secondary"
          loading={busy === 'cancel'}
          onPress={() => confirmAction('Cancel this lesson?', lessonLabel(lesson), 'Cancel lesson', () => act('cancel'))}
        />
      ) : null}
      <Button label="Chat with my instructor" variant="secondary" onPress={() => router.push('/student/chat')} />
    </Screen>
  );
}
