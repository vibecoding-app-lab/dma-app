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
  created_at: string;
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
