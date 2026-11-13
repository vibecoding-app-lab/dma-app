import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { DateTimeInput } from '@/components/DateTimeInput';
import { SlotPicker } from '@/components/SlotPicker';
import { Button, Card, Choice, Field, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { bookingAction, lessonLabel } from '@/lib/booking';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';

const pad = (n: number) => String(n).padStart(2, '0');

/** Next quarter hour from now, as a local date and "HH:MM". */
function nextQuarter() {
  const d = new Date(Math.ceil(Date.now() / 900_000) * 900_000);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/**
 * Instructor books a lesson for one student. It's confirmed straight away,
 * goes on Google Calendar, and the student gets an update. Any time works,
 * including within the next 2 hours.
 */
export default function InstructorBook() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const [name, setName] = useState('Student');
  const [manual, setManual] = useState(true);
  const [hours, setHours] = useState<1 | 2>(1);
  const [start, setStart] = useState<string | null>(null);
  const [date, setDate] = useState(nextQuarter().date);
  const [time, setTime] = useState(nextQuarter().time);
  const [pickup, setPickup] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', studentId)
      .single()
      .then(({ data }) => setName(data?.full_name ?? data?.email ?? 'Student'));
  }, [studentId]);

  async function book() {
    let startsAt = start;
    if (manual) {
      const d = new Date(`${date}T${time}:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(+d)) return notify('Check the time', 'Pick a date and a start time.');
      startsAt = d.toISOString();
    }
    if (!startsAt) return notify('Pick a time', 'Choose a start time first.');
    setSaving(true);
    try {
      const booking = await bookingAction({
        action: 'instructor_book',
        student_id: studentId,
        starts_at: startsAt,
        duration_hours: hours,
        pickup_location: pickup,
        notes,
      });
      notify('Lesson booked', `${name}, ${lessonLabel(booking)}.\n\nIt's on your Google Calendar and ${name} has been told.`);
      router.back();
    } catch (e) {
      notify('Could not book', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.brand, fontSize: 16 }}>‹ Back</Text>
      </Pressable>
      <Title>Book a lesson for {name}</Title>
      <Subtitle>
        The lesson is confirmed straight away and added to your Google Calendar. The student gets an update. You can
        book any time, even within the next 2 hours.
      </Subtitle>

      <Card>
        <Choice
          options={[
            { value: 'manual', label: 'Pick any time' },
            { value: 'free', label: 'My free times' },
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
          </>
        ) : (
          <SlotPicker hours={hours} onHours={setHours} selected={start} onSelect={setStart} />
        )}
      </Card>

      <Card>
        <Field label="Pickup address (optional)" value={pickup} onChangeText={setPickup} />
        <Field label="Note for the student (optional)" value={notes} onChangeText={setNotes} multiline />
      </Card>

      <Button label="Book and confirm" onPress={book} loading={saving} />
    </Screen>
  );
}
