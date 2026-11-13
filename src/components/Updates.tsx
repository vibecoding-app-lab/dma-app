import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, SectionLabel, colors } from '@/components/ui';
import { type AppNotification, dismissNotifications, fetchNotifications, notificationText } from '@/lib/booking';

/**
 * Unread updates for the signed-in person (new requests, new times, cancellations).
 * Checks again every minute while the screen is open. `onChange` lets the
 * screen reload its lessons when something new arrives.
 */
export function Updates({ onChange }: { onChange?: () => void }) {
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    const next = await fetchNotifications();
    setItems((prev) => {
      if (next.some((n) => !prev.find((p) => p.id === n.id)) && prev.length) onChange?.();
      return next;
    });
  }, [onChange]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

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
              {new Date(n.created_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
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
