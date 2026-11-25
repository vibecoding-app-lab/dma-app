import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, router, usePathname } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { unreadCounts } from '@/lib/chat';
import { confirmAction } from '@/lib/notify';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

type IconName = keyof typeof Ionicons.glyphMap;
type Item = { label: string; icon: IconName; href: Href; match: (path: string) => boolean; badge?: number };

/** The bar across the top of every screen, for students and instructors. */
export function NavBar({ role }: { role: 'student' | 'instructor' }) {
  const { profile, signOut } = useAuth();
  const path = usePathname();
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    if (!profile) return;
    const counts = await unreadCounts(profile.id);
    setUnread(Object.values(counts).reduce((a, b) => a + b, 0));
  }, [profile?.id]);
  useLiveRefresh(loadUnread);

  const items: Item[] =
    role === 'student'
      ? [
          { label: 'Home', icon: 'home', href: '/student', match: (p) => p === '/student' },
          ...(profile?.assigned_instructor_id
            ? ([
                { label: 'Book', icon: 'calendar', href: '/student/book', match: (p) => p.startsWith('/student/book') },
                { label: 'Lessons', icon: 'list', href: '/student/lessons?show=booked', match: (p) => p.startsWith('/student/lesson') },
              ] as Item[])
            : []),
        ]
      : [
          { label: 'Home', icon: 'home', href: '/instructor', match: (p) => p === '/instructor' },
          {
            label: 'Students',
            icon: 'people',
            href: '/instructor/students',
            match: (p) => /^\/instructor\/(students|student\/|chat\/|book\/|transfer|in-car)/.test(p),
            badge: unread,
          },
          { label: 'Hours', icon: 'time', href: '/instructor/hours', match: (p) => p.startsWith('/instructor/hours') },
          { label: 'Profile', icon: 'person-circle', href: '/instructor/profile', match: (p) => p.startsWith('/instructor/profile') },
        ];

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
      <View style={{ alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.border }}>
        <Logo width={170} />
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 6, gap: 2, backgroundColor: colors.brand }}>
        {items.map((it) => {
          const active = it.match(path);
          return (
            <Tab
              key={it.label}
              label={it.label}
              icon={it.icon}
              active={active}
              badge={it.badge}
              onPress={() => (active ? null : router.navigate(it.href))}
            />
          );
        })}
        <Tab
          label="Sign out"
          icon="log-out"
          onPress={() => confirmAction('Sign out?', 'You can sign back in any time.', 'Sign out', async () => signOut())}
        />
      </View>
    </SafeAreaView>
  );
}

function Tab({ label, icon, active, badge, onPress }: { label: string; icon: IconName; active?: boolean; badge?: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: active ? '#FFFFFF' : pressed ? colors.brandDark : 'transparent',
      })}
    >
      <View>
        <Ionicons name={active ? icon : (`${icon}-outline` as IconName)} size={22} color={active ? colors.brand : '#FFFFFF'} />
        {badge ? (
          <View style={{ position: 'absolute', top: -4, right: -12, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.ink }}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: active ? colors.brand : '#FFFFFF', marginTop: 2 }}>
        {label}
      </Text>
    </Pressable>
  );
}
