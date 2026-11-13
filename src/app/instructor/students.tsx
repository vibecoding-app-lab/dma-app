import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PackagePicker, packageProblem } from '@/components/PackagePicker';
import { Button, Card, ErrorText, Field, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { Booking } from '@/lib/booking';
import { unreadCounts } from '@/lib/chat';
import { notify } from '@/lib/notify';
import { packageLabel, progressOf, totalLessons } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import type { PackageId, Profile } from '@/lib/types';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

export default function Students() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [lessons, setLessons] = useState<Booking[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [email, setEmail] = useState('');
  const [pkg, setPkg] = useState<PackageId | null>(null);
  const [privateLessons, setPrivateLessons] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: list, error: loadError }, { data: bookings }, counts] = await Promise.all([
      supabase.from('profiles').select('*').eq('assigned_instructor_id', profile.id).order('full_name'),
      supabase
        .from('bookings')
        .select('id, student_id, starts_at, ends_at, status')
        .eq('instructor_id', profile.id)
        .in('status', ['pending', 'confirmed', 'completed']),
      unreadCounts(profile.id),
    ]);
    if (loadError) setError(loadError.message);
    setStudents(list ?? []);
    setLessons((bookings as Booking[]) ?? []);
    setUnread(counts);
  }, [profile]);

  useLiveRefresh(load, 30_000);

  async function addStudent() {
    const problem = packageProblem(pkg, privateLessons);
    if (problem) return setError(problem);
    setAdding(true);
    setError(null);
    try {
      const { data: student, error: rpcError } = await supabase.rpc('assign_student', { student_email: email });
      if (rpcError) {
        setError(
          rpcError.message.startsWith('No student account')
            ? 'No student has signed up with that email yet. Ask them to sign up in the app first.'
            : rpcError.message,
        );
        return;
      }
      const { error: pkgError } = await supabase.rpc('set_student_package', {
        p_student_id: (student as Profile).id,
        p_package: pkg,
        p_lessons_total: pkg === 'private' ? Number(privateLessons) : null,
      });
      if (pkgError) setError(`Student added, but the package wasn't saved: ${pkgError.message}`);
      else notify('Student added', `${(student as Profile).full_name ?? email} can now book lessons with you.`);
      setEmail('');
      setPkg(null);
      setPrivateLessons('');
      load();
    } finally {
      setAdding(false);
    }
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.brand, fontSize: 16 }}>‹ Back</Text>
      </Pressable>
      <Title>My students</Title>

      <Card>
        <SectionLabel>ADD A STUDENT</SectionLabel>
        <Field
          label="Student's email"
          value={email}
          onChangeText={setEmail}
          placeholder="student@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <PackagePicker value={pkg} onChange={setPkg} privateLessons={privateLessons} onPrivateLessons={setPrivateLessons} />
        <Button label="Add student" onPress={addStudent} loading={adding} disabled={!email.includes('@')} />
        <ErrorText message={error} />
      </Card>

      {students.length === 0 ? <Subtitle>No students yet.</Subtitle> : null}
      {students.map((student) => {
        const total = totalLessons(student);
        const p = progressOf(lessons.filter((b) => b.student_id === student.id), total);
        const share = total ? Math.min(1, p.done / total) : 0;
        const messages = unread[student.id] ?? 0;
        return (
          <Pressable key={student.id} onPress={() => router.push(`/instructor/student/${student.id}`)}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', flex: 1 }}>{student.full_name ?? 'Name not set'}</Text>
                {messages ? (
                  <View style={{ backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      {messages} new message{messages === 1 ? '' : 's'}
                    </Text>
                  </View>
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 20 }}>›</Text>
              </View>
              <Subtitle>
                {student.username ? `@${student.username} · ` : ''}
                {packageLabel(student.package, student.lessons_total, student.extra_lessons)}
              </Subtitle>
              {total ? (
                <>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: '#EEEEEE', overflow: 'hidden' }}>
                    <View style={{ width: `${share * 100}%`, height: 8, backgroundColor: colors.success }} />
                  </View>
                  <Text style={{ fontSize: 14, color: colors.muted }}>
                    {p.done} of {total} done · {p.booked} booked · {p.left} left
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 14, color: colors.muted }}>{p.done} done · {p.booked} booked</Text>
              )}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
