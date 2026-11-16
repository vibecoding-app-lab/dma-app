import { router, usePathname } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { unreadCounts } from '@/lib/chat';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

/** Round chat button that floats in the student's bottom-right corner on every screen. */
export function ChatButton() {
  const { profile } = useAuth();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    const counts = await unreadCounts(profile.id);
    setUnread(Object.values(counts).reduce((a, b) => a + b, 0));
  }, [profile?.id]);
  useLiveRefresh(load);

  if (!profile?.assigned_instructor_id || path.startsWith('/student/chat')) return null;
  return (
    <Pressable
      onPress={() => router.push('/student/chat')}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Chat with my instructor, ${unread} new` : 'Chat with my instructor'}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 18,
        bottom: 18 + insets.bottom,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: pressed ? colors.brandDark : colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      })}
    >
      <Text style={{ fontSize: 26 }}>💬</Text>
      {unread ? (
        <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#FFD43B', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.ink }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
