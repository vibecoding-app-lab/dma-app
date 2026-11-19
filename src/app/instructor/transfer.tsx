import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, ErrorText, Field, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmAction, notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

/** Move one of your students to another instructor, found by their email. */
export default function Transfer() {
  const { profile } = useAuth();
  const { student: preselected } = useLocalSearchParams<{ student?: string }>();
  const [students, setStudents] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<string | null>(preselected || null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('profiles').select('*').eq('assigned_instructor_id', profile.id).order('full_name');
    setStudents((data as Profile[]) ?? []);
  }, [profile?.id]);
  useLiveRefresh(load, 60_000);

  const student = students.find((s) => s.id === picked) ?? null;
  const nameOf = (s: Profile) => s.full_name ?? s.email;

  async function transfer() {
    if (!student) return setError('Pick the student to transfer.');
    const to = email.trim().toLowerCase();
    if (!to.includes('@')) return setError("Enter the other instructor's email.");
    if (to === profile?.email?.toLowerCase()) return setError('That is your own email. Enter the other instructor’s email.');
    setError(null);
    confirmAction(
      'Transfer this student?',
      `${nameOf(student)} will move to ${to}. They will book with the new instructor from now on. Lessons already booked stay as they are.`,
      'Transfer',
      async () => {
        setBusy(true);
        const { error: e } = await supabase.rpc('transfer_student', { p_student_id: student.id, p_instructor_email: to });
        setBusy(false);
        if (e) {
          notify('Could not transfer', e.message);
          setError(e.message);
          return;
        }
        notify('Student transferred', `${nameOf(student)} now belongs to ${to}. Both of them have been told.`);
        router.replace('/instructor/students');
      },
    );
  }

  return (
    <Screen>
      <Title>Transfer a student</Title>
      <Subtitle>Pick a student, enter the email of the instructor taking over, and tap Transfer. The email must belong to an instructor registered in the app.</Subtitle>

      <Card>
        <SectionLabel>1. STUDENT</SectionLabel>
        {students.length === 0 ? <Subtitle>You have no students to transfer.</Subtitle> : null}
        {students.map((s) => {
          const on = s.id === picked;
          return (
            <Pressable
              key={s.id}
              onPress={() => setPicked(s.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: on ? colors.brand : colors.border,
                backgroundColor: on ? '#FDECEE' : '#FFFFFF',
              }}
            >
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? colors.brand : '#B0B0B0', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600' }}>{nameOf(s)}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>{s.email}</Text>
              </View>
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <SectionLabel>2. NEW INSTRUCTOR</SectionLabel>
        <Field
          label="Instructor's email"
          value={email}
          onChangeText={setEmail}
          placeholder="instructor@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Card>

      <ErrorText message={error} />
      <Button
        label={student ? `Transfer ${student.first_name ?? nameOf(student)}` : 'Transfer'}
        onPress={transfer}
        loading={busy}
        disabled={!student || !email.includes('@')}
      />
    </Screen>
  );
}
