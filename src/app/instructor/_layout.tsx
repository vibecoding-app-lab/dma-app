import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function InstructorLayout() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session || (profile?.role !== 'instructor' && profile?.role !== 'admin')) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
