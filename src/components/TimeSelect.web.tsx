import { colors } from '@/components/ui';
import { QUARTER_HOURS, to12 } from '@/lib/time12';

/** Website version: a list of times every 15 minutes, on a 12-hour clock. */
export function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const options = QUARTER_HOURS.includes(value) ? QUARTER_HOURS : [...QUARTER_HOURS, value].sort();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 16,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        background: '#fff',
        color: colors.ink,
        minWidth: 120,
      }}
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {to12(t)}
        </option>
      ))}
    </select>
  );
}
