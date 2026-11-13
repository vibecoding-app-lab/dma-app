import { Text, View } from 'react-native';

import { Card, SectionLabel, Subtitle, colors } from '@/components/ui';
import { progressOf } from '@/lib/progress';
import type { Booking } from '@/lib/booking';

/** "6 of 10 lessons done", a bar, and what's booked and left. */
export function ProgressCard({
  bookings,
  total,
  packageText,
  title = 'MY PROGRESS',
}: {
  bookings: Booking[];
  total: number | null;
  packageText: string;
  title?: string;
}) {
  const p = progressOf(bookings, total);
  const doneShare = total ? Math.min(1, p.done / total) : 0;
  const bookedShare = total ? Math.min(1 - doneShare, p.booked / total) : 0;
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
          <View style={{ width: `${bookedShare * 100}%`, backgroundColor: '#F2C14E' }} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Done" value={p.done} color={colors.success} />
        <Stat label="Booked" value={p.booked} color="#B7860B" />
        {p.left != null ? <Stat label="Left" value={p.left} color={colors.ink} /> : null}
      </View>
      <Subtitle>One lesson is one hour, so a 2 hour lesson counts as 2.</Subtitle>
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F7', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color }}>{value}</Text>
      <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
    </View>
  );
}
