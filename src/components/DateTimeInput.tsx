import { Text, TextInput, View } from 'react-native';

import { TimeSelect } from '@/components/TimeSelect';
import { colors } from '@/components/ui';

/**
 * A date ("YYYY-MM-DD") and a time ("HH:MM", 24 hour). In the phone app these
 * are typed; the website version (DateTimeInput.web.tsx) uses the browser's
 * own date and time pickers.
 */
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
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={label}>Date (YYYY-MM-DD)</Text>
        <TextInput value={date} onChangeText={onDate} style={box} placeholder="2026-11-20" inputMode="numeric" />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={label}>Start time</Text>
        <TimeSelect value={time} onChange={onTime} label="Start time" />
      </View>
    </View>
  );
}

const label = { fontSize: 14, fontWeight: '600' as const, color: colors.ink };
const box = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
  fontSize: 16,
  backgroundColor: '#fff',
};
