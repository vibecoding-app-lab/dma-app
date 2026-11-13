import { View } from 'react-native';

import { Choice, Field, SectionLabel } from '@/components/ui';
import { PACKAGES } from '@/lib/progress';
import type { PackageId } from '@/lib/types';

/** Package 1 / 2 / 3 / Private, plus the lesson count for a private student. */
export function PackagePicker({
  value,
  onChange,
  privateLessons,
  onPrivateLessons,
}: {
  value: PackageId | null;
  onChange: (p: PackageId) => void;
  privateLessons: string;
  onPrivateLessons: (v: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>PACKAGE</SectionLabel>
      <Choice
        options={PACKAGES.map((p) => ({ value: p.id, label: p.lessons ? `${p.label} · ${p.lessons}` : p.label }))}
        value={value}
        onChange={(v) => onChange(v as PackageId)}
      />
      {value === 'private' ? (
        <Field
          label="Total lessons for this private student"
          value={privateLessons}
          onChangeText={(t) => onPrivateLessons(t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="e.g. 8"
        />
      ) : null}
    </View>
  );
}

/** Checks the choice; returns an error message or null. */
export function packageProblem(value: PackageId | null, privateLessons: string) {
  if (!value) return 'Choose a package.';
  if (value === 'private') {
    const n = Number(privateLessons);
    if (!Number.isInteger(n) || n < 1 || n > 500) return 'Enter how many lessons the private student has (1 to 500).';
  }
  return null;
}
