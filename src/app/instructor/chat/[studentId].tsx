import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ChatThread } from '@/components/ChatThread';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function InstructorChat() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const { profile } = useAuth();
  const [student, setStudent] = useState<{ full_name: string | null; username: string | null; email: string } | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name, username, email')
      .eq('id', studentId)
      .single()
      .then(({ data }) => setStudent(data ?? null));
  }, [studentId]);

  if (!profile || !studentId) return <Loading />;
  return (
    <ChatThread
      studentId={studentId}
      instructorId={profile.id}
      myId={profile.id}
      title={student?.full_name ?? student?.email ?? 'Student'}
      subtitle={student?.username ? `@${student.username}` : 'Student'}
      onBack={() => router.back()}
    />
  );
}
