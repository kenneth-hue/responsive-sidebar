export type StaffRole = "lecturer" | "ta";
export type SessionStatus = "active" | "ended";

export interface Profile {
  id: string;
  full_name: string;
  role: StaffRole;
  created_at: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface Student {
  id: string;
  index_number: string;
  full_name: string;
  created_at: string;
  has_face?: boolean;
}

export interface Session {
  id: string;
  course_id: string;
  started_by: string;
  starts_at: string;
  ends_at: string | null;
  status: SessionStatus;
  lat: number;
  lng: number;
  radius_m: number;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  device_hash: string;
  checked_in_at: string;
  index_number?: string;
  full_name?: string;
}

export interface FaceEmbedding {
  student_id: string;
  embedding: number[];
  enrolled_at: string;
}

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
}
