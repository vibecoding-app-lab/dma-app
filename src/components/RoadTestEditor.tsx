import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { DateTimeInput } from '@/components/DateTimeInput';
import { RoadTestCard } from '@/components/RoadTestCard';
import { Button, Card, ErrorText, Field, SectionLabel, Subtitle } from '@/components/ui';
import { confirmAction, notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import type { RoadTest } from '@/lib/types';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Instructor books, changes or removes one student's road test. The student is told each time. */
export function RoadTestEditor({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [test, setTest] = useState<RoadTest | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('road_tests').select('*').eq('student_id', studentId).maybeSingle();
    setTest((data as RoadTest | null) ?? null);
  }, [studentId]);
  useLiveRefresh(load, 60_000);

  function startEditing() {
    const d = test ? new Date(test.starts_at) : new Date(Date.now() + 7 * 86_400_000);
    setDate(dayOf(d));
    setTime(test ? timeOf(d) : '09:00');
    setLocation(test?.location ?? '');
    setNotes(test?.notes ?? '');
    setError(null);
    setEditing(true);
  }

  async function save() {
    const when = new Date(`${date}T${time}:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(+when)) return setError('Pick the date and time of the test.');
    if (!location.trim()) return setError('Enter where the test is, for example the DriveTest centre.');
    setSaving(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('set_road_test', {
      p_student_id: studentId,
      p_starts_at: when.toISOString(),
      p_location: location.trim(),
      p_notes: notes.trim() || null,
    });
    setSaving(false);
    if (e) return setError(e.message);
    const changed = Boolean(test);
    setTest(data as RoadTest);
    setEditing(false);
    notify(changed ? 'Road test updated' : 'Road test booked', `${studentName} has been told.`);
  }

  function remove() {
    confirmAction('Remove road test?', `${studentName} will be told it was removed.`, 'Remove', async () => {
      const { error: e } = await supabase.rpc('clear_road_test', { p_student_id: studentId });
      if (e) return notify('Could not remove', e.message);
      setTest(null);
      setEditing(false);
    });
  }

  if (test === undefined) return null;

  if (editing) {
    return (
      <Card>
        <SectionLabel>{test ? 'CHANGE ROAD TEST' : 'BOOK THE ROAD TEST'}</SectionLabel>
        <DateTimeInput date={date} time={time} onDate={setDate} onTime={setTime} />
        <Field label="Location" value={location} onChangeText={setLocation} placeholder="e.g. DriveTest Etobicoke, 5555 Eglinton Ave W" />
        <Field label="Note for the student (optional)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. Meet me 1 hour before for a warm-up drive" />
        <Subtitle>The student gets a notification and sees the test at the top of their home screen.</Subtitle>
        <ErrorText message={error} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label={test ? 'Save changes' : 'Book test'} onPress={save} loading={saving} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} />
          </View>
        </View>
      </Card>
    );
  }

  if (!test) return <Button label="Book the Road Test" onPress={startEditing} />;

  return (
    <View style={{ gap: 8 }}>
      <RoadTestCard test={test} title="ROAD TEST BOOKED" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="Edit road test" variant="secondary" onPress={startEditing} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Remove" variant="secondary" onPress={remove} />
        </View>
      </View>
      <Subtitle>{studentName} sees this at the top of their home screen.</Subtitle>
    </View>
  );
}

