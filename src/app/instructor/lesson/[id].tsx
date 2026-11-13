import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';

import { SlotPicker } from '@/components/SlotPicker';
import { Button, Card, Loading, Pill, Screen, SectionLabel, Subtitle, Title } from '@/components/ui';
import { type Booking, STATUS_LABEL, bookingAction, lessonHours, lessonLabel } from '@/lib/booking';
import { confirmAction, notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';

export default function EditLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lesson, setLesson] = useState<Booking | null>(null);
  const [hours, setHours] = useState<1 | 2>(1);
  const [start, setStart] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*, student:profiles!bookings_student_id_fkey(full_name, phone, email)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setLesson(data as Booking);
        setHours(lessonHours(data as Booking));
      });
  }, [id]);

  if (!lesson) return <Loading />;
  const active = lesson.status === 'pending' || lesson.status === 'confirmed';
  const student = lesson.student;

  async function saveMove() {
    if (!start || !lesson) return;
    setWorking(true);
    try {
      const updated = await bookingAction({ action: 'reschedule', booking_id: lesson.id, starts_at: start, duration_hours: hours });
      notify('Lesson changed', `${lessonLabel(updated)}\n\nPlease let the student know.`);
      router.back();
    } catch (e) {
      notify('Could not change the lesson', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  }

  function cancel() {
    if (!lesson) return;
    confirmAction('Cancel this lesson?', lessonLabel(lesson), 'Cancel lesson', async () => {
      setWorking(true);
      try {
        await bookingAction({ action: 'cancel', booking_id: lesson.id });
        router.back();
      } catch (e) {
        notify('Could not cancel', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setWorking(false);
      }
    });
  }

  return (
    <Screen>
      <Title>{student?.full_name ?? student?.email ?? 'Lesson'}</Title>
      <Card>
        <Text style={{ fontSize: 17, fontWeight: '600' }}>{lessonLabel(lesson)}</Text>
        <Pill label={STATUS_LABEL[lesson.status]} tone={lesson.status === 'confirmed' ? 'good' : 'neutral'} />
        {lesson.pickup_location ? <Subtitle>Pickup: {lesson.pickup_location}</Subtitle> : null}
        {lesson.notes ? <Subtitle>Note: {lesson.notes}</Subtitle> : null}
        {student?.phone ? (
          <Button label={`Call ${student.phone}`} variant="secondary" onPress={() => Linking.openURL(`tel:${student.phone}`)} />
        ) : null}
      </Card>

      {active && !moving ? <Button label="Change time or length" onPress={() => setMoving(true)} /> : null}

      {active && moving ? (
        <Card>
          <SectionLabel>NEW TIME</SectionLabel>
          <SlotPicker hours={hours} onHours={setHours} selected={start} onSelect={setStart} excludeBookingId={lesson.id} />
          <Button label="Save new time" onPress={saveMove} loading={working} disabled={!start} />
        </Card>
      ) : null}

      {active ? <Button label="Cancel lesson" variant="secondary" onPress={cancel} loading={working && !moving} /> : null}
      <Button label="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
