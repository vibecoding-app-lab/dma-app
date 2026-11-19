import { Pressable, Text } from 'react-native';

/** Phone app: tap to step through the options (blank, X, /, √ ...). */
export function SheetChoice({
  value,
  options,
  fontSize,
  onChange,
  label,
}: {
  value: string;
  options: string[];
  fontSize: number;
  onChange: (v: string) => void;
  label: string;
}) {
  const i = Math.max(0, options.indexOf(value));
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => onChange(options[(i + 1) % options.length])}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(66,133,244,0.06)' }}
    >
      <Text style={{ fontSize, fontWeight: '700', color: '#0B3D91' }}>{value.trim()}</Text>
    </Pressable>
  );
}
