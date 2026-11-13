import type { Booking } from './booking';
import type { PackageId } from './types';

export const PACKAGES: { id: PackageId; label: string; lessons: number | null }[] = [
  { id: 'package_1', label: 'Package 1', lessons: 10 },
  { id: 'package_2', label: 'Package 2', lessons: 10 },
  { id: 'package_3', label: 'Package 3', lessons: 15 },
  { id: 'private', label: 'Private', lessons: null },
];

export function packageLabel(id: PackageId | null | undefined, total?: number | null) {
  const p = PACKAGES.find((x) => x.id === id);
  if (!p) return 'No package set';
  return `${p.label} (${total ?? p.lessons} lessons)`;
}

const hoursOf = (b: Booking) => Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 3_600_000);

/**
 * Lesson counts for one student. One lesson = one hour, so a 2 hour lesson
 * counts as 2. "Done" means completed, or confirmed and already over.
 */
export function progressOf(bookings: Booking[], total: number | null) {
  const now = Date.now();
  let done = 0;
  let booked = 0;
  for (const b of bookings) {
    if (b.status === 'completed' || (b.status === 'confirmed' && Date.parse(b.ends_at) <= now)) done += hoursOf(b);
    else if (b.status === 'confirmed' || b.status === 'pending') booked += hoursOf(b);
  }
  const left = total == null ? null : Math.max(0, total - done - booked);
  return { done, booked, left, total };
}

/** Lessons that are over but have no remarks yet. */
export function needsRemarks(b: Booking) {
  return (b.status === 'confirmed' || b.status === 'completed') && Date.parse(b.starts_at) <= Date.now() && !b.remarks;
}
