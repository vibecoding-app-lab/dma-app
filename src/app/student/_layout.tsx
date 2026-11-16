import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';

import { ChatButton } from '@/components/ChatButton';
import { NavBar } from '@/components/NavBar';
import { HasNavBar, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function StudentLayout() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session || profile?.role !== 'student') return <Redirect href="/" />;
  return (
    <HasNavBar.Provider value={true}>
      <View style={{ flex: 1 }}>
        <NavBar role="student" />
        <Stack screenOptions={{ headerShown: false }} />
        <ChatButton />
      </View>
    </HasNavBar.Provider>
  );
}
