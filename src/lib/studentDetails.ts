import type { LicenseClass, Profile } from './types';

export const LICENSE_CLASSES: { value: LicenseClass; label: string }[] = [
  { value: 'G1', label: 'G1' },
  { value: 'G2', label: 'G2' },
  { value: 'G', label: 'G' },
];

/** True when a student has filled in everything the school needs. */
export function studentDetailsComplete(p: Profile) {
  // Until the database update adds these columns, only ask for what exists.
  const has = (col: string) => col in (p as object);
  if (!has('license_class')) return Boolean(p.full_name && p.phone && p.username);
  const base = Boolean(
    p.full_name && p.phone && p.username && p.address && p.license_number && p.license_expiry && p.license_class,
  );
  if (!has('postal_code')) return base;
  const more = base && Boolean(p.first_name && p.last_name && p.postal_code && p.license_issue_date);
  return has('terms_accepted_at') ? more && Boolean(p.terms_accepted_at) : more;
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

/** Canadian postal code "A1A 1A1", or the text as typed if it isn't one. */
export function cleanPostalCode(v: string) {
  const t = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(t) ? `${t.slice(0, 3)} ${t.slice(3)}` : v.trim().toUpperCase();
}
