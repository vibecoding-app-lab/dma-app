export type UserRole = 'student' | 'instructor' | 'admin';

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  email: string;
  username: string | null;
  push_token: string | null;
  assigned_instructor_id: string | null;
  package: PackageId | null;
  lessons_total: number | null;
  extra_lessons: number;
  address: string | null;
  license_number: string | null;
  /** "YYYY-MM-DD" */
  license_expiry: string | null;
  license_class: LicenseClass | null;
  first_name: string | null;
  last_name: string | null;
  postal_code: string | null;
  /** "YYYY-MM-DD" */
  license_issue_date: string | null;
  /** Instructors only: driving instructor licence number and its expiry year, printed on the in-car sheet. */
  di_number: string | null;
  di_licence_expiry_year: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  created_at: string;
};

export type LicenseClass = 'G1' | 'G2' | 'G';

export type RoadTest = {
  student_id: string;
  instructor_id: string;
  starts_at: string;
  location: string;
  notes: string | null;
  updated_at: string;
};

export type Instructor = {
  profile_id: string;
  bio: string | null;
  car_type: 'manual' | 'automatic' | null;
  google_calendar_id: string;
  google_connected_at: string | null;
  timezone: string;
};

export type BusyBlock = { start: string; end: string };

export type PackageId = 'package_1' | 'package_2' | 'package_3' | 'private';
