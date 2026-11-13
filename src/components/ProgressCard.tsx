import { Pressable, Text, View } from 'react-native';

import { Card, SectionLabel, Subtitle, colors } from '@/components/ui';
import { type ProgressKind, progressOf } from '@/lib/progress';
import type { Booking } from '@/lib/booking';

/** "6 of 10 lessons done", a bar, and what's booked and left. */
export function ProgressCard({
  bookings,
  total,
  packageText,
  title = 'MY PROGRESS',
  onSelect,
}: {
  bookings: Booking[];
  total: number | null;
  packageText: string;
  title?: string;
  /** When given, each box can be tapped to see those lessons. */
  onSelect?: (kind: ProgressKind) => void;
}) {
  const p = progressOf(bookings, total);
  const doneShare = total ? Math.min(1, p.done / total) : 0;
  const nowShare = total ? Math.min(1 - doneShare, p.inProgress / total) : 0;
  const bookedShare = total ? Math.min(1 - doneShare - nowShare, p.booked / total) : 0;
  return (
    <Card>
      <SectionLabel>{title}</SectionLabel>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>
        {total ? `${p.done} of ${total} lessons done` : `${p.done} lesson${p.done === 1 ? '' : 's'} done`}
      </Text>
      <Subtitle>{packageText}</Subtitle>
      {total ? (
        <View style={{ height: 12, borderRadius: 6, backgroundColor: '#EEEEEE', flexDirection: 'row', overflow: 'hidden' }}>
          <View style={{ width: `${doneShare * 100}%`, backgroundColor: colors.success }} />
          <View style={{ width: `${nowShare * 100}%`, backgroundColor: '#4285F4' }} />
          <View style={{ width: `${bookedShare * 100}%`, backgroundColor: '#F2C14E' }} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Done" value={p.done} color={colors.success} onPress={onSelect && (() => onSelect('done'))} />
        {p.inProgress ? <Stat label="In progress" value={p.inProgress} color="#1A5FD0" onPress={onSelect && (() => onSelect('in_progress'))} /> : null}
        <Stat label="Booked" value={p.booked} color="#B7860B" onPress={onSelect && (() => onSelect('booked'))} />
        {p.left != null ? <Stat label="Left" value={p.left} color={colors.ink} onPress={onSelect && (() => onSelect('left'))} /> : null}
      </View>
      <Subtitle>
        One lesson is one hour, so a 2 hour lesson counts as 2.{onSelect ? ' Tap a box to see those lessons.' : ''}
      </Subtitle>
    </Card>
  );
}

function Stat({ label, value, color, onPress }: { label: string; value: number; color: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: pressed ? '#ECECEC' : '#F7F7F7',
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: onPress ? 1 : 0,
        borderColor: colors.border,
      })}
    >
      <Text style={{ fontSize: 22, fontWeight: '700', color }}>{value}</Text>
      <Text style={{ fontSize: 13, color: colors.muted }}>
        {label}
      </Text>
    </Pressable>
  );
}
