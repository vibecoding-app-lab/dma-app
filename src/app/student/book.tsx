import { router } from 'expo-router';
import { useState } from 'react';

import { SlotPicker } from '@/components/SlotPicker';
import { Button, Card, Field, Screen, Subtitle, Title } from '@/components/ui';
import { bookingAction, lessonLabel } from '@/lib/booking';
import { notify } from '@/lib/notify';

export default function BookLesson() {
  const [hours, setHours] = useState<1 | 2>(1);
  const [start, setStart] = useState<string | null>(null);
  const [pickup, setPickup] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!start) return;
    setSending(true);
    try {
      const booking = await bookingAction({
        action: 'request',
        starts_at: start,
        duration_hours: hours,
        pickup_location: pickup,
        notes,
      });
      notify('Request sent', `${lessonLabel(booking)}\n\nYour instructor will accept or decline it.`);
      router.back();
    } catch (e) {
      notify('Could not book', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <Title>Book a lesson</Title>
      <Subtitle>These are the times your instructor is free. Your instructor confirms every request.</Subtitle>

      <Card>
        <SlotPicker hours={hours} onHours={setHours} selected={start} onSelect={setStart} />
      </Card>

      <Card>
        <Field label="Pickup address (optional)" value={pickup} onChangeText={setPickup} placeholder="e.g. 12 King St" />
        <Field label="Note for your instructor (optional)" value={notes} onChangeText={setNotes} multiline />
      </Card>

      <Button label="Send request" onPress={send} loading={sending} disabled={!start} />
      <Button label="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
