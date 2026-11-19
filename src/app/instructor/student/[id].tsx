import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { PackagePicker, packageProblem } from '@/components/PackagePicker';
import { ProgressCard } from '@/components/ProgressCard';
import { RemarksView } from '@/components/Remarks';
import { RoadTestEditor } from '@/components/RoadTestEditor';
import { LessonStatePill } from '@/components/LessonStatePill';
import { Button, Card, ErrorText, Loading, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatDay } from '@/lib/studentDetails';
import { type Booking, lessonLabel } from '@/lib/booking';
import { unreadCounts } from '@/lib/chat';
import { confirmAction, notify } from '@/lib/notify';
import { needsRemarks, packageLabel, totalLessons } from '@/lib/progress';
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
  const [savingExtra, setSavingExtra] = useState(false);

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

  async function changeExtra(by: number) {
    if (!student) return;
    const next = Math.max(0, student.extra_lessons + by);
    setSavingExtra(true);
    setStudent({ ...student, extra_lessons: next });
    const { error: e } = await supabase.rpc('set_extra_lessons', { p_student_id: id, p_extra: next });
    setSavingExtra(false);
    if (e) {
      notify('Could not save', e.message);
      load();
    }
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

      <Card>
        <SectionLabel>STUDENT DETAILS</SectionLabel>
        <Detail label="First name" value={student.first_name ?? student.full_name?.split(' ')[0]} />
        <Detail label="Last name" value={student.last_name ?? student.full_name?.split(' ').slice(1).join(' ')} />
        <Detail label="Email" value={student.email} />
        <Detail label="Phone" value={student.phone} />
        <Detail label="Address" value={student.address} />
        <Detail label="Postal code" value={student.postal_code} />
        <Detail label="Licence #" value={student.license_number} />
        <Detail label="Licence class" value={student.license_class} />
        <Detail label="Issue date" value={student.license_issue_date ? formatDay(student.license_issue_date) : null} />
        <Detail
          label="Expiry date"
          value={student.license_expiry ? formatDay(student.license_expiry) : null}
          warn={!!student.license_expiry && Date.parse(student.license_expiry) < Date.now()}
        />
        <Detail label="Username" value={student.username ? `@${student.username}` : null} />
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="In-car sheet" variant="secondary" onPress={() => router.push(`/instructor/in-car/${id}`)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Transfer student" variant="secondary" onPress={() => router.push(`/instructor/transfer?student=${id}`)} />
        </View>
      </View>

      <Button label="Book a lesson for this student" onPress={() => router.push(`/instructor/book/${id}`)} />
      <RoadTestEditor studentId={id} studentName={student.full_name ?? 'The student'} />


      <ProgressCard
        bookings={active}
        total={totalLessons(student)}
        packageText={packageLabel(student.package, student.lessons_total, student.extra_lessons)}
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

      <Card>
        <SectionLabel>EXTRA LESSONS</SectionLabel>
        <Subtitle>Lessons on top of the package, for example if the student buys more.</Subtitle>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Stepper label="−" onPress={() => changeExtra(-1)} disabled={student.extra_lessons <= 0 || savingExtra} />
          <Text style={{ fontSize: 26, fontWeight: '700', minWidth: 40, textAlign: 'center' }}>{student.extra_lessons}</Text>
          <Stepper label="+" onPress={() => changeExtra(1)} disabled={savingExtra} />
          <Text style={{ color: colors.muted, flex: 1 }}>
            {student.extra_lessons === 1 ? 'extra lesson' : 'extra lessons'}
          </Text>
        </View>
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
            <LessonStatePill lesson={b} />
            <RemarksView lesson={b} />
          </Pressable>
        ))}
      </Card>

      <Button label="Remove student" variant="secondary" onPress={remove} />
    </Screen>
  );
}

function Detail({ label, value, warn }: { label: string; value: string | null | undefined; warn?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}>
      <Text style={{ width: 120, fontSize: 14, color: colors.muted }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: warn ? colors.brand : value ? colors.ink : colors.muted }}>
        {value || 'Not given yet'}
        {warn ? '  (expired)' : ''}
      </Text>
    </View>
  );
}

function Stepper({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label === '+' ? 'Add an extra lesson' : 'Remove an extra lesson'}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 24, color: colors.brand, lineHeight: 26 }}>{label}</Text>
    </Pressable>
  );
}
