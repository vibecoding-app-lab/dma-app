import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { PackagePicker, packageProblem } from '@/components/PackagePicker';
import { ProgressCard } from '@/components/ProgressCard';
import { Button, Card, ErrorText, Loading, Pill, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { type Booking, STATUS_LABEL, lessonLabel } from '@/lib/booking';
import { unreadCounts } from '@/lib/chat';
import { confirmAction, notify } from '@/lib/notify';
import { needsRemarks, packageLabel } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import type { PackageId, Profile } from '@/lib/types';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

export default function StudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [student, setStudent] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<Booking[]>([]);
  const [unread, setUnread] = useState(0);
  const [editingPkg, setEditingPkg] = useState(false);
  const [pkg, setPkg] = useState<PackageId | null>(null);
  const [privateLessons, setPrivateLessons] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: s }, { data: b }, counts] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('bookings')
        .select('*')
        .eq('student_id', id)
        .eq('instructor_id', profile.id)
        .order('starts_at', { ascending: false }),
      unreadCounts(profile.id),
    ]);
    setStudent(s ?? null);
    setLessons((b as Booking[]) ?? []);
    setUnread(counts[id] ?? 0);
  }, [id, profile]);

  useLiveRefresh(load, 30_000);

  if (!student) return <Loading />;

  async function savePackage() {
    const problem = packageProblem(pkg, privateLessons);
    if (problem) return setError(problem);
    setSaving(true);
    const { error: e } = await supabase.rpc('set_student_package', {
      p_student_id: id,
      p_package: pkg,
      p_lessons_total: pkg === 'private' ? Number(privateLessons) : null,
    });
    setSaving(false);
    if (e) return setError(e.message);
    setError(null);
    setEditingPkg(false);
    load();
  }

  function remove() {
    confirmAction(
      'Remove student?',
      `${student?.full_name ?? student?.email} will no longer be able to book with you.`,
      'Remove',
      async () => {
        const { error: e } = await supabase.rpc('unassign_student', { student_id: id });
        if (e) return notify('Could not remove', e.message);
        router.back();
      },
    );
  }

  const active = lessons.filter((b) => ['pending', 'confirmed', 'completed'].includes(b.status));
  const waiting = active.filter(needsRemarks);

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.brand, fontSize: 16 }}>‹ My students</Text>
      </Pressable>
      <Title>{student.full_name ?? student.email}</Title>
      <Subtitle>
        {student.username ? `@${student.username} · ` : ''}
        {student.email}
      </Subtitle>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            label={unread ? `Chat (${unread} new)` : 'Chat'}
            onPress={() => router.push(`/instructor/chat/${id}`)}
          />
        </View>
        {student.phone ? (
          <View style={{ flex: 1 }}>
            <Button label="Call" variant="secondary" onPress={() => Linking.openURL(`tel:${student.phone}`)} />
          </View>
        ) : null}
      </View>

      <ProgressCard
        bookings={active}
        total={student.lessons_total}
        packageText={packageLabel(student.package, student.lessons_total)}
        title="PROGRESS"
      />

      <Card>
        {editingPkg ? (
          <>
            <PackagePicker value={pkg} onChange={setPkg} privateLessons={privateLessons} onPrivateLessons={setPrivateLessons} />
            <ErrorText message={error} />
            <Button label="Save package" onPress={savePackage} loading={saving} />
            <Button label="Cancel" variant="secondary" onPress={() => setEditingPkg(false)} />
          </>
        ) : (
          <Button
            label="Change package"
            variant="secondary"
            onPress={() => {
              setPkg(student.package);
              setPrivateLessons(student.package === 'private' && student.lessons_total ? String(student.lessons_total) : '');
              setEditingPkg(true);
            }}
          />
        )}
      </Card>

      {waiting.length ? (
        <Card>
          <SectionLabel>WAITING FOR YOUR REMARKS</SectionLabel>
          {waiting.map((b) => (
            <Pressable key={b.id} onPress={() => router.push(`/instructor/lesson/${b.id}`)} style={{ paddingVertical: 6 }}>
              <Text style={{ fontSize: 15 }}>{lessonLabel(b)}</Text>
              <Text style={{ color: colors.brand, fontWeight: '600' }}>Add remarks ›</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionLabel>ALL LESSONS</SectionLabel>
        {lessons.length === 0 ? <Subtitle>No lessons yet.</Subtitle> : null}
        {lessons.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => router.push(`/instructor/lesson/${b.id}`)}
            style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600' }}>{lessonLabel(b)}</Text>
            <Pill
              label={b.status === 'confirmed' && Date.parse(b.ends_at) < Date.now() ? 'Done' : STATUS_LABEL[b.status]}
              tone={b.status === 'completed' || b.status === 'confirmed' ? 'good' : b.status === 'pending' ? 'waiting' : 'neutral'}
            />
            {b.remarks ? <Text style={{ fontSize: 14, color: colors.ink }}>Remarks: {b.remarks}</Text> : null}
          </Pressable>
        ))}
      </Card>

      <Button label="Remove student" variant="secondary" onPress={remove} />
    </Screen>
  );
}
