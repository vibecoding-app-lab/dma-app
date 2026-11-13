import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function StudentLayout() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session || profile?.role !== 'student') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
