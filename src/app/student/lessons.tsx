import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { LessonStatePill } from '@/components/LessonStatePill';
import { RemarksLink } from '@/components/Remarks';
import { Card, Loading, Screen, Subtitle, Title, colors } from '@/components/ui';
import { type Booking, lessonLabel } from '@/lib/booking';
import { type ProgressKind, lessonState } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

const TITLES: Record<Exclude<ProgressKind, 'left'>, { title: string; empty: string }> = {
  done: { title: 'Lessons done', empty: 'No finished lessons yet.' },
  in_progress: { title: 'Lesson in progress', empty: 'No lesson is happening right now.' },
  booked: { title: 'Booked lessons', empty: 'No lessons booked. Book one from the home screen.' },
};

/** The lessons behind one of the progress boxes (Done, In progress, Booked). */
export default function StudentLessons() {
  const { show } = useLocalSearchParams<{ show: string }>();
  const kind = (show && show in TITLES ? show : 'booked') as keyof typeof TITLES;
  const { profile } = useAuth();
  const [lessons, setLessons] = useState<Booking[] | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('bookings').select('*').eq('student_id', profile.id).order('starts_at');
    setLessons((data as Booking[]) ?? []);
  }, [profile]);
  useLiveRefresh(load);

  if (!lessons) return <Loading />;
  const list = lessons.filter((b) => {
    const s = lessonState(b);
    if (kind === 'booked') return s === 'confirmed' || s === 'pending';
    return s === kind;
  });
  if (kind === 'done') list.reverse();

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/student'))}>
        <Text style={{ color: colors.brand, fontSize: 16 }}>‹ Back</Text>
      </Pressable>
      <Title>{TITLES[kind].title}</Title>
      <Card>
        {list.length === 0 ? <Subtitle>{TITLES[kind].empty}</Subtitle> : null}
        {list.map((b, i) => (
          <Pressable
            key={b.id}
            onPress={() => router.push(`/student/lesson/${b.id}`)}
            style={{ gap: 6, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{lessonLabel(b)}</Text>
            <LessonStatePill lesson={b} />
            {b.pickup_location ? <Subtitle>Pickup: {b.pickup_location}</Subtitle> : null}
            <RemarksLink lesson={b} onPress={() => router.push(`/student/lesson/${b.id}`)} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
