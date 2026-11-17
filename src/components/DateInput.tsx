import { Field } from '@/components/ui';

/** Phone app version: the date is typed as YYYY-MM-DD. */
export function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <Field label={`${label} (YYYY-MM-DD)`} value={value} onChangeText={onChange} placeholder="2027-05-31" inputMode="numeric" />;
}
