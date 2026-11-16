import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { TimeSelect } from '@/components/TimeSelect';

import { Button, Card, Choice, Loading, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';

// Monday first; the database counts 0 = Sunday.
const DAYS = [
  { weekday: 1, label: 'Monday' },
  { weekday: 2, label: 'Tuesday' },
  { weekday: 3, label: 'Wednesday' },
  { weekday: 4, label: 'Thursday' },
  { weekday: 5, label: 'Friday' },
  { weekday: 6, label: 'Saturday' },
  { weekday: 0, label: 'Sunday' },
];

type Day = { on: boolean; start: string; end: string };

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function tidy(t: string) {
  const m = TIME.exec(t.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export default function WorkingHours() {
  const { profile } = useAuth();
  const [days, setDays] = useState<Record<number, Day> | null>(null);
  const [buffer, setBuffer] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('availability_rules')
      .select('weekday, start_time, end_time, buffer_min')
      .eq('instructor_id', profile.id)
      .then(({ data }) => {
        const next: Record<number, Day> = {};
        for (const d of DAYS) next[d.weekday] = { on: false, start: '09:00', end: '17:00' };
        for (const r of data ?? []) {
          next[r.weekday] = { on: true, start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) };
        }
        setDays(next);
        setBuffer(Math.max(0, ...(data ?? []).map((r) => r.buffer_min ?? 0)));
      });
  }, [profile]);

  if (!days) return <Loading />;

  function update(weekday: number, change: Partial<Day>) {
    setDays((d) => (d ? { ...d, [weekday]: { ...d[weekday], ...change } } : d));
  }

  async function save() {
    if (!profile || !days) return;
    const rows = [];
    for (const { weekday, label } of DAYS) {
      const d = days[weekday];
      if (!d.on) continue;
      const start = tidy(d.start);
      const end = tidy(d.end);
      if (!start || !end) return notify('Check the times', `${label}: enter times like 9:00 AM and 5:30 PM.`);
      if (end <= start) return notify('Check the times', `${label}: the end time must be after the start time.`);
      rows.push({ instructor_id: profile.id, weekday, start_time: start, end_time: end, buffer_min: buffer });
    }
    setSaving(true);
    try {
      const { error: delError } = await supabase.from('availability_rules').delete().eq('instructor_id', profile.id);
      if (delError) throw delError;
      if (rows.length) {
        const { error } = await supabase.from('availability_rules').insert(rows);
        if (error) throw error;
      }
      // Hours are read in the instructor's own time zone; keep it current.
      await supabase.from('instructors').update({ timezone: deviceZone }).eq('profile_id', profile.id);
      notify('Saved', 'Students can now book inside these hours, except when your Google Calendar is busy.');
      (router.canGoBack() ? router.back() : router.replace('/instructor'));
    } catch (e) {
      notify('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Title>Working hours</Title>
      <Subtitle>
        Students can only book inside these hours. Anything busy on your Google Calendar is blocked automatically, so
        for a day off just add it to your calendar.
      </Subtitle>
      <Subtitle>Time zone: {deviceZone.replace('_', ' ')}</Subtitle>

      <Card>
        {DAYS.map(({ weekday, label }) => {
          const d = days[weekday];
          return (
            <View key={weekday} style={{ paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '600' }}>{label}</Text>
                <Switch
                  value={d.on}
                  onValueChange={(on) => update(weekday, { on })}
                  trackColor={{ true: colors.brand, false: colors.border }}
                  thumbColor="#ffffff"
                />
              </View>
              {d.on ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TimeSelect value={d.start} onChange={(start) => update(weekday, { start })} label={`${label} start time`} />
                  <Text style={{ color: colors.muted }}>to</Text>
                  <TimeSelect value={d.end} onChange={(end) => update(weekday, { end })} label={`${label} end time`} />
                </View>
              ) : (
                <Text style={{ color: colors.muted }}>Not working</Text>
              )}
            </View>
          );
        })}
      </Card>

      <Card>
        <SectionLabel>BREAK BETWEEN LESSONS</SectionLabel>
        <Choice
          options={[
            { value: 0, label: 'None' },
            { value: 15, label: '15 min' },
            { value: 30, label: '30 min' },
          ]}
          value={buffer}
          onChange={setBuffer}
        />
      </Card>

      <Button label="Save hours" onPress={save} loading={saving} />
      <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/instructor'))} />
    </Screen>
  );
}
