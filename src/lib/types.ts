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
