import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';

import { DateTimeInput } from '@/components/DateTimeInput';
import { SlotPicker } from '@/components/SlotPicker';
import { Button, Card, Choice, Field, Loading, Pill, Screen, SectionLabel, Subtitle, Title } from '@/components/ui';
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
  const [message, setMessage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [savingRemarks, setSavingRemarks] = useState(false);
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
        setRemarks((data as Booking).remarks ?? '');
        setHours(lessonHours(data as Booking));
        const d = new Date((data as Booking).starts_at);
        const pad = (n: number) => String(n).padStart(2, '0');
        setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      });
  }, [id]);

  if (!lesson) return <Loading />;
  const started = Date.parse(lesson.starts_at) <= Date.now();
  const active = (lesson.status === 'pending' || lesson.status === 'confirmed') && !started;
  const canRemark = (lesson.status === 'confirmed' || lesson.status === 'completed') && started;
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
      const updated = await bookingAction({ action: 'reschedule', booking_id: lesson.id, starts_at: start, duration_hours: hours, message });
      notify('Sent to the student', `New time: ${lessonLabel({ starts_at: updated.proposed_starts_at!, ends_at: updated.proposed_ends_at! })}\n\nThe student will be asked to accept it. Both times stay blocked until they answer.`);
      router.back();
    } catch (e) {
      notify('Could not change the lesson', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  }

  async function saveRemarks() {
    if (!lesson) return;
    setSavingRemarks(true);
    try {
      const updated = await bookingAction({ action: 'remarks', booking_id: lesson.id, remarks });
      setLesson({ ...lesson, ...updated });
      notify('Remarks saved', 'The student can now see them.');
    } catch (e) {
      notify('Could not save remarks', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingRemarks(false);
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
        {lesson.proposed_starts_at && lesson.proposed_ends_at ? (
          <Subtitle>
            New time sent, waiting for the student:{' '}
            {lessonLabel({ starts_at: lesson.proposed_starts_at, ends_at: lesson.proposed_ends_at })}
            {lesson.proposal_message ? `\nYour message: "${lesson.proposal_message}"` : ''}
          </Subtitle>
        ) : null}
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
          <Field
            label="Message to the student (optional)"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
            placeholder="e.g. I have a test booked at 10, can we do 1:15 instead?"
          />
          <Subtitle>The student will be asked to accept the new time. Until then, both times stay blocked.</Subtitle>
          <Button label="Send new time to student" onPress={saveMove} loading={working} disabled={!manual && !start} />
        </Card>
      ) : null}

      {canRemark ? (
        <Card>
          <SectionLabel>LESSON REMARKS</SectionLabel>
          <Subtitle>
            {lesson.remarks
              ? 'The student can see these remarks. You can update them.'
              : 'How did the lesson go? The student sees this once you save it.'}
          </Subtitle>
          <Field
            label="Remarks"
            value={remarks}
            onChangeText={setRemarks}
            multiline
            maxLength={2000}
            placeholder="e.g. Good mirror checks. Practise parallel parking and roundabouts next time."
          />
          <Button label={lesson.remarks ? 'Update remarks' : 'Save remarks'} onPress={saveRemarks} loading={savingRemarks} disabled={!remarks.trim()} />
        </Card>
      ) : null}

      {active ? <Button label="Cancel lesson" variant="secondary" onPress={cancel} loading={working && !moving} /> : null}
      <Button label="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
