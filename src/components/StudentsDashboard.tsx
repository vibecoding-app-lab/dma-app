import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, SectionLabel, Subtitle, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { Booking } from '@/lib/booking';
import { studentStage } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

/** Filters the students list understands, shared with the My students screen. */
export const STUDENT_FILTERS = {
  in_progress: 'In progress',
  completed: 'Completed',
  not_started: 'Not started',
  package_1: 'Package 1',
  package_2: 'Package 2',
  package_3: 'Package 3',
  private: 'Private',
  no_package: 'No package yet',
} as const;
export type StudentFilter = keyof typeof STUDENT_FILTERS;

export function matchesFilter(filter: StudentFilter, student: Profile, bookings: Booking[]) {
  if (filter === 'in_progress' || filter === 'completed' || filter === 'not_started') {
    return studentStage(student, bookings) === filter;
  }
  if (filter === 'no_package') return !student.package;
  return student.package === filter;
}

/** Instructor overview: every student so far, by stage and by package. Each box opens that list. */
export function StudentsDashboard() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Profile[] | null>(null);
  const [lessons, setLessons] = useState<Booking[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: list }, { data: bookings }] = await Promise.all([
      supabase.from('profiles').select('*').eq('assigned_instructor_id', profile.id),
      supabase
        .from('bookings')
        .select('id, student_id, starts_at, ends_at, status')
        .eq('instructor_id', profile.id)
        .in('status', ['pending', 'confirmed', 'completed']),
    ]);
    setStudents((list as Profile[]) ?? []);
    setLessons((bookings as Booking[]) ?? []);
  }, [profile?.id]);
  useLiveRefresh(load, 60_000);

  if (!students) return null;
  const count = (f: StudentFilter) =>
    students.filter((s) => matchesFilter(f, s, lessons.filter((b) => b.student_id === s.id))).length;
  const open = (f?: StudentFilter) => router.push(f ? `/instructor/students?filter=${f}` : '/instructor/students');
  const noPackage = count('no_package');

  return (
    <Card>
      <SectionLabel>DASHBOARD</SectionLabel>
      <Pressable onPress={() => open()}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>
          {students.length} student{students.length === 1 ? '' : 's'} so far
        </Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Box label="In progress" value={count('in_progress')} color="#1A5FD0" onPress={() => open('in_progress')} />
        <Box label="Completed" value={count('completed')} color={colors.success} onPress={() => open('completed')} />
        <Box label="Not started" value={count('not_started')} color={colors.muted} onPress={() => open('not_started')} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 4 }}>BY PACKAGE</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Box label="Package 1" value={count('package_1')} color={colors.ink} onPress={() => open('package_1')} />
        <Box label="Package 2" value={count('package_2')} color={colors.ink} onPress={() => open('package_2')} />
        <Box label="Package 3" value={count('package_3')} color={colors.ink} onPress={() => open('package_3')} />
        <Box label="Private" value={count('private')} color={colors.ink} onPress={() => open('private')} />
      </View>
      <Subtitle>
        {noPackage ? `${noPackage} student${noPackage === 1 ? ' has' : 's have'} no package yet. ` : ''}Tap a box to see
        those students.
      </Subtitle>
    </Card>
  );
}

function Box({ label, value, color, onPress }: { label: string; value: number; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: pressed ? '#ECECEC' : '#F7F7F7',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 10,
        alignItems: 'center',
      })}
    >
      <Text style={{ fontSize: 22, fontWeight: '700', color }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>
        {label}
      </Text>
    </Pressable>
  );
}
