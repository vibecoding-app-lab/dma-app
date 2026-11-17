import { Text, View } from 'react-native';

import { colors } from '@/components/ui';

/** Website version: the browser's own date picker. Value is "YYYY-MM-DD". */
export function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{label}</Text>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          padding: '11px 12px',
          fontSize: 16,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#fff',
          color: colors.ink,
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </View>
  );
}
