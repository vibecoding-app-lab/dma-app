import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';

import { colors } from '@/components/ui';
import { from12, to12 } from '@/lib/time12';

/**
 * A time of day shown on a 12-hour clock. `value` is "HH:MM" (24 hour).
 * Phone app: typed, e.g. "2:15 PM". The website uses a list (TimeSelect.web.tsx).
 */
export function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [text, setText] = useState(to12(value));
  useEffect(() => setText(to12(value)), [value]);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => {
        const parsed = from12(text);
        if (parsed) onChange(parsed);
        else setText(to12(value));
      }}
      accessibilityLabel={label}
      placeholder="9:00 AM"
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        minWidth: 110,
        backgroundColor: '#fff',
      }}
    />
  );
}
