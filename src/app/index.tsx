import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { studentDetailsComplete } from '@/lib/studentDetails';

// Sends each user to the right home screen for their role.
export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading || (session && !profile)) return <Loading />;
  if (!session || !profile) return <Redirect href="/sign-in" />;
  if (profile.role === 'instructor' || profile.role === 'admin') return <Redirect href="/instructor" />;
  if (!studentDetailsComplete(profile)) return <Redirect href="/complete-profile" />;
  return <Redirect href="/student" />;
}
