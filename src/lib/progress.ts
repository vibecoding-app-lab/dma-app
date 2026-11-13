import type { Booking } from './booking';
import type { PackageId } from './types';

export const PACKAGES: { id: PackageId; label: string; lessons: number | null }[] = [
  { id: 'package_1', label: 'Package 1', lessons: 10 },
  { id: 'package_2', label: 'Package 2', lessons: 10 },
  { id: 'package_3', label: 'Package 3', lessons: 15 },
  { id: 'private', label: 'Private', lessons: null },
];

export function packageLabel(id: PackageId | null | undefined, total?: number | null, extra = 0) {
  const p = PACKAGES.find((x) => x.id === id);
  const plus = extra > 0 ? ` + ${extra} extra` : '';
  if (!p) return extra > 0 ? `No package, ${extra} extra lessons` : 'No package set';
  return `${p.label} (${total ?? p.lessons} lessons${plus})`;
}

/** All lessons a student may take: package plus extras, or null when neither is set. */
export function totalLessons(p: { lessons_total: number | null; extra_lessons?: number | null } | null | undefined) {
  if (!p) return null;
  const extra = p.extra_lessons ?? 0;
  if (p.lessons_total == null && extra === 0) return null;
  return (p.lessons_total ?? 0) + extra;
}

const hoursOf = (b: Booking) => Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 3_600_000);

/** Where a lesson is right now, by the clock. */
export function lessonState(b: Booking): 'in_progress' | 'done' | Booking['status'] {
  const now = Date.now();
  if (b.status === 'confirmed' || b.status === 'completed') {
    if (Date.parse(b.ends_at) <= now) return 'done';
    if (Date.parse(b.starts_at) <= now) return 'in_progress';
    return 'confirmed';
  }
  return b.status;
}

/**
 * Lesson counts for one student. One lesson = one hour, so a 2 hour lesson
 * counts as 2. A lesson counts as done only once its time is over.
 */
export function progressOf(bookings: Booking[], total: number | null) {
  let done = 0;
  let inProgress = 0;
  let booked = 0;
  for (const b of bookings) {
    const state = lessonState(b);
    if (state === 'done') done += hoursOf(b);
    else if (state === 'in_progress') inProgress += hoursOf(b);
    else if (state === 'confirmed' || state === 'pending') booked += hoursOf(b);
  }
  const left = total == null ? null : Math.max(0, total - done - inProgress - booked);
  return { done, inProgress, booked, left, total };
}

/** Lessons that are over but have no remarks yet. */
export function needsRemarks(b: Booking) {
  return (
    (b.status === 'confirmed' || b.status === 'completed') &&
    Date.parse(b.starts_at) <= Date.now() &&
    !b.remarks &&
    !(b.remarks_items && b.remarks_items.length)
  );
}
