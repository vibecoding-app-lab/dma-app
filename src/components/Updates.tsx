import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, SectionLabel, colors } from '@/components/ui';
import { useLiveRefresh } from '@/lib/useLiveRefresh';
import { type AppNotification, dismissNotifications, fetchNotifications, notificationText } from '@/lib/booking';

/**
 * Unread updates for the signed-in person (new requests, new times, cancellations).
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
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionLabel>UPDATES ({items.length})</SectionLabel>
        <Pressable onPress={() => dismiss(items.map((n) => n.id))}>
          <Text style={{ color: colors.brand, fontWeight: '600' }}>Clear all</Text>
        </Pressable>
      </View>
      {items.map((n) => (
        <View
          key={n.id}
          style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6, borderTopWidth: 1, borderColor: colors.border }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 7 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: colors.ink }}>{notificationText(n.message)}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {new Date(n.created_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
            </Text>
          </View>
          <Pressable onPress={() => dismiss([n.id])} accessibilityLabel="Dismiss" hitSlop={10}>
            <Text style={{ fontSize: 18, color: colors.muted }}>×</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}
