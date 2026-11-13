import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/components/ui';
import { useLiveRefresh } from '@/lib/useLiveRefresh';
import { type AppNotification, dismissNotifications, fetchNotifications, notificationText } from '@/lib/booking';

/**
 * Unread notifications for the signed-in person (new requests, new times, cancellations).
 * Checks every 20 seconds and whenever the person comes back to the app.
 * `onChange` reloads the screen's lessons at the same moments.
 */
export function Updates({ onChange }: { onChange?: () => void }) {
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    const next = await fetchNotifications();
    setItems(next);
  }, []);

  // The screen's own lessons refresh on the same rhythm (see onChange).
  useLiveRefresh(() => {
    load();
    onChange?.();
  });

  if (!items.length) return null;

  async function dismiss(ids: string[]) {
    setItems((list) => list.filter((n) => !ids.includes(n.id)));
    await dismissNotifications(ids);
  }

  return (
    <View
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: colors.brand,
        backgroundColor: '#FFF5F6',
        shadowColor: colors.brand,
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ fontSize: 18 }}>🔔</Text>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', flex: 1 }}>Notifications</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 999, minWidth: 26, paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center' }}>
          <Text style={{ color: colors.brand, fontWeight: '800' }}>{items.length}</Text>
        </View>
        <Pressable onPress={() => dismiss(items.map((n) => n.id))} hitSlop={8}>
          <Text style={{ color: '#fff', fontWeight: '600', textDecorationLine: 'underline' }}>Clear all</Text>
        </Pressable>
      </View>
      {items.map((n, i) => (
        <View
          key={n.id}
          style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: '#F3D3D8' }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand, marginTop: 6 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 16, color: colors.ink, fontWeight: '600', lineHeight: 22 }}>{notificationText(n.message)}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {new Date(n.created_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
            </Text>
          </View>
          <Pressable onPress={() => dismiss([n.id])} accessibilityLabel="Dismiss" hitSlop={10}>
            <Text style={{ fontSize: 20, color: colors.muted }}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
