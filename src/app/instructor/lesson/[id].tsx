import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';

import { DateTimeInput } from '@/components/DateTimeInput';
import { SlotPicker } from '@/components/SlotPicker';
import { Button, Card, Choice, Loading, Pill, Screen, SectionLabel, Subtitle, Title } from '@/components/ui';
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
  const [manual, setManual] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

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
        const d = new Date((data as Booking).starts_at);
        const pad = (n: number) => String(n).padStart(2, '0');
        setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      });
  }, [id]);

  if (!lesson) return <Loading />;
  const active = lesson.status === 'pending' || lesson.status === 'confirmed';
  const student = lesson.student;

  /** The typed date and time as a moment, or null if they don't make sense. */
  function typedStart(): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim()) || !/^\d{1,2}:\d{2}$/.test(time.trim())) return null;
    const [hh, mm] = time.trim().split(':');
    const d = new Date(`${date.trim()}T${hh.padStart(2, '0')}:${mm}:00`);
    return Number.isNaN(+d) ? null : d.toISOString();
  }

  async function saveMove() {
    if (!lesson) return;
    if (manual) {
      const typed = typedStart();
      if (!typed) return notify('Check the time', 'Enter a date and a start time, for example 2026-11-20 and 14:15.');
      if (Date.parse(typed) < Date.now()) return notify('Check the time', 'That time has already passed.');
      return move(typed);
    }
    if (start) return move(start);
  }

  async function move(start: string) {
    if (!lesson) return;
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
          <Choice
            options={[
              { value: 'free', label: 'My free times' },
              { value: 'manual', label: 'Type a time' },
            ]}
            value={manual ? 'manual' : 'free'}
            onChange={(v) => setManual(v === 'manual')}
          />
          {manual ? (
            <>
              <SectionLabel>LESSON LENGTH</SectionLabel>
              <Choice
                options={[
                  { value: 1, label: '1 hour' },
                  { value: 2, label: '2 hours' },
                ]}
                value={hours}
                onChange={(h) => setHours(h as 1 | 2)}
              />
              <DateTimeInput date={date} time={time} onDate={setDate} onTime={setTime} />
              <Subtitle>Any time works here, even outside your working hours. Make sure your calendar is free.</Subtitle>
            </>
          ) : (
            <SlotPicker hours={hours} onHours={setHours} selected={start} onSelect={setStart} excludeBookingId={lesson.id} />
          )}
          <Button label="Save new time" onPress={saveMove} loading={working} disabled={!manual && !start} />
        </Card>
      ) : null}

      {active ? <Button label="Cancel lesson" variant="secondary" onPress={cancel} loading={working && !moving} /> : null}
      <Button label="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
