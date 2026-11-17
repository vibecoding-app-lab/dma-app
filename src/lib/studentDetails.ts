import type { LicenseClass, Profile } from './types';

export const LICENSE_CLASSES: { value: LicenseClass; label: string }[] = [
  { value: 'G1', label: 'G1' },
  { value: 'G2', label: 'G2' },
  { value: 'G', label: 'G' },
];

/** True when a student has filled in everything the school needs. */
export function studentDetailsComplete(p: Profile) {
  // Until the database update adds these columns, don't block anyone.
  if (!('license_class' in (p as object))) return Boolean(p.full_name && p.phone && p.username);
  return Boolean(
    p.full_name && p.phone && p.username && p.address && p.license_number && p.license_expiry && p.license_class,
  );
}

/** "May 31, 2027" from "2027-05-31", without time-zone surprises. */
export function formatDay(day: string | null | undefined) {
  if (!day) return '';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isValidDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
}
