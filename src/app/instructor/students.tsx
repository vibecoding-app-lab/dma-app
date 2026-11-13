import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Button, Card, ErrorText, Field, Screen, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmAction } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function Students() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('*')
      .eq('assigned_instructor_id', profile.id)
      .order('full_name');
    if (loadError) setError(loadError.message);
    setStudents(data ?? []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function addStudent() {
    setAdding(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('assign_student', { student_email: email });
    setAdding(false);
    if (rpcError) {
      setError(
        rpcError.message.startsWith('No student account')
          ? 'No student has signed up with that email yet. Ask them to sign in to the app first.'
          : rpcError.message,
      );
      return;
    }
    setEmail('');
    load();
  }

  function removeStudent(student: Profile) {
    confirmAction(
      'Remove student?',
      `${student.full_name ?? student.email} will no longer be able to book with you.`,
      'Remove',
      async () => {
        const { error: rpcError } = await supabase.rpc('unassign_student', { student_id: student.id });
        if (rpcError) setError(rpcError.message);
        load();
      },
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.brand, fontSize: 16 }}>Back</Text>
      </Pressable>
      <Title>My students</Title>

      <Card>
        <Field
          label="Add a student by email"
          value={email}
          onChangeText={setEmail}
          placeholder="student@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button label="Add student" onPress={addStudent} loading={adding} disabled={!email.includes('@')} />
        <ErrorText message={error} />
      </Card>

      {students.length === 0 ? (
        <Subtitle>No students yet.</Subtitle>
      ) : (
        students.map((student) => (
          <Card key={student.id}>
            <Text style={{ fontSize: 17, fontWeight: '600' }}>{student.full_name ?? 'Name not set'}</Text>
            <Subtitle>{student.email}</Subtitle>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {student.phone ? (
                <View style={{ flex: 1 }}>
                  <Button label="Call" variant="secondary" onPress={() => Linking.openURL(`tel:${student.phone}`)} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button label="Remove" variant="secondary" onPress={() => removeStudent(student)} />
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
