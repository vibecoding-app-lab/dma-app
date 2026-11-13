import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  type CalendarItem,
  type CalendarMode,
  type WorkingHours,
  CalendarLegend,
  CalendarView,
  addDays,
  startOfDay,
  startOfWeek,
} from '@/components/CalendarView';
import { Choice, ErrorText, colors } from '@/components/ui';
import { type Booking, fetchCalendarEvents } from '@/lib/booking';
import { supabase } from '@/lib/supabase';

/**
 * The instructor's Google Calendar and Drive Master Academy lessons together,
 * in a day / 3 day / week view. `refreshKey` reloads it after a change.
 */
export function InstructorCalendar({ instructorId, refreshKey = 0 }: { instructorId: string; refreshKey?: number }) {
  const [mode, setMode] = useState<CalendarMode>(3);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState<WorkingHours>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = anchor;
    const to = addDays(anchor, mode);
    try {
      const [events, { data: bookings }, { data: rules }] = await Promise.all([
        fetchCalendarEvents(mode, from).catch((e) => {
          setError(e instanceof Error ? e.message : 'Could not read your Google Calendar.');
          return [];
        }),
        supabase
          .from('bookings')
          .select('*, student:profiles!bookings_student_id_fkey(full_name, phone, email)')
          .eq('instructor_id', instructorId)
          .in('status', ['pending', 'confirmed'])
          .or(
            `and(starts_at.lt.${to.toISOString()},ends_at.gt.${from.toISOString()}),` +
              `and(proposed_starts_at.lt.${to.toISOString()},proposed_ends_at.gt.${from.toISOString()})`,
          ),
        supabase.from('availability_rules').select('weekday, start_time, end_time').eq('instructor_id', instructorId),
      ]);
      const wh: WorkingHours = {};
      for (const r of rules ?? []) {
        (wh[r.weekday] ??= []).push({ start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) });
      }
      setHours(wh);
      const lessons = (bookings as Booking[]) ?? [];
      const lessonEventIds = new Set(lessons.map((b) => b.google_event_id).filter(Boolean));
      setItems([
        ...lessons.map(
          (b): CalendarItem => ({
            id: b.id,
            title: b.student?.full_name ?? b.student?.email ?? 'Student',
            subtitle: b.proposed_starts_at ? 'Moving, waiting for student' : b.status === 'pending' ? 'Request, tap to answer' : (b.pickup_location ?? undefined),
            start: new Date(b.starts_at),
            end: new Date(b.ends_at),
            kind: b.status === 'pending' ? 'request' : 'lesson',
            onPress: () => router.push(`/instructor/lesson/${b.id}`),
          }),
        ),
        ...lessons
          .filter((b) => b.proposed_starts_at && b.proposed_ends_at)
          .map(
            (b): CalendarItem => ({
              id: `${b.id}-proposed`,
              title: `${b.student?.full_name ?? 'Student'} (new time?)`,
              subtitle: 'Waiting for student',
              start: new Date(b.proposed_starts_at!),
              end: new Date(b.proposed_ends_at!),
              kind: 'request',
              onPress: () => router.push(`/instructor/lesson/${b.id}`),
            }),
          ),
        ...events
          .filter((e) => !lessonEventIds.has(e.id))
          .map(
            (e): CalendarItem => ({
              id: e.id,
              title: e.summary,
              start: new Date(e.start),
              end: new Date(e.end),
              allDay: e.allDay,
              kind: e.busy ? 'google' : 'free',
            }),
          ),
      ]);
    } finally {
      setLoading(false);
    }
  }, [anchor, mode, instructorId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  function changeMode(m: CalendarMode) {
    setMode(m);
    if (m === 7) setAnchor(startOfWeek(anchor));
  }

  const title = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', flex: 1 }}>{title}</Text>
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        <Arrow label="‹" onPress={() => setAnchor(addDays(anchor, -mode))} />
        <Pressable
          onPress={() => setAnchor(mode === 7 ? startOfWeek(new Date()) : startOfDay(new Date()))}
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Text style={{ fontWeight: '600' }}>Today</Text>
        </Pressable>
        <Arrow label="›" onPress={() => setAnchor(addDays(anchor, mode))} />
      </View>
      <Choice
        options={[
          { value: 1, label: 'Day' },
          { value: 3, label: '3 days' },
          { value: 7, label: 'Week' },
        ]}
        value={mode}
        onChange={(m) => changeMode(m as CalendarMode)}
      />
      <CalendarView
        anchor={anchor}
        mode={mode}
        items={items}
        workingHours={hours}
        onSelectDay={(d) => {
          setMode(1);
          setAnchor(d);
        }}
      />
      <CalendarLegend />
      <ErrorText message={error} />
    </View>
  );
}

function Arrow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label === '‹' ? 'Previous' : 'Next'}
      style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F1F1' }}
    >
      <Text style={{ fontSize: 22, lineHeight: 24, color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}
