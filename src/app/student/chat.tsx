import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { ChatThread } from '@/components/ChatThread';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function StudentChat() {
  const { profile } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const instructorId = profile?.assigned_instructor_id;

  useEffect(() => {
    if (!instructorId) return;
    supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', instructorId)
      .single()
      .then(({ data }) => setName(data?.full_name ?? (data?.username ? `@${data.username}` : 'My instructor')));
  }, [instructorId]);

  if (!profile || !instructorId) return <Loading />;
  return (
    <ChatThread
      studentId={profile.id}
      instructorId={instructorId}
      myId={profile.id}
      title={name ?? 'My instructor'}
      subtitle="Your instructor"
      onBack={() => router.back()}
    />
  );
}
