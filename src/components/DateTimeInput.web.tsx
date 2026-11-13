import { Text, View } from 'react-native';

import { TimeSelect } from '@/components/TimeSelect';
import { colors } from '@/components/ui';

/** Website version: the browser's own date and time pickers. */
export function DateTimeInput({
  date,
  time,
  onDate,
  onTime,
}: {
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
}) {
  const box = {
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: '11px 12px',
    fontSize: 16,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    background: '#fff',
    color: colors.ink,
    width: '100%',
    boxSizing: 'border-box' as const,
  };
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Date</Text>
        <input type="date" value={date} onChange={(e) => onDate(e.target.value)} style={box} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Start time</Text>
        <TimeSelect value={time} onChange={onTime} label="Start time" />
      </View>
    </View>
  );
}
