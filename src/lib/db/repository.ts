import { isDemoMode } from "@/lib/config";
import * as demo from "@/lib/demo/store";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type {
  AttendanceRecord,
  Course,
  Session,
  StaffRole,
  Student,
} from "@/lib/types";

export async function signupStaff(input: {
  email: string;
  password: string;
  full_name: string;
  role: StaffRole;
}) {
  if (isDemoMode()) return demo.demoSignup(input);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.full_name, role: input.role },
    },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Signup failed");
  return {
    user: {
      id: data.user.id,
      email: input.email,
      full_name: input.full_name,
      role: input.role,
    },
  };
}

export async function loginStaff(email: string, password: string) {
  if (isDemoMode()) return demo.demoLogin(email, password);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Login failed");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", data.user.id)
    .single();

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? email,
      full_name: profile?.full_name ?? "Staff",
      role: profile?.role ?? "lecturer",
    },
  };
}

export async function listCourses(userId: string): Promise<Course[]> {
  if (isDemoMode()) return demo.demoListCourses(userId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select("*").order("created_at", {
    ascending: false,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Course[];
}

export async function createCourse(input: {
  code: string;
  name: string;
  created_by: string;
}): Promise<Course> {
  if (isDemoMode()) return demo.demoCreateCourse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("course_staff").insert({
    course_id: data.id,
    profile_id: input.created_by,
  });
  return data as Course;
}

export async function getCourse(courseId: string, userId: string): Promise<Course | null> {
  if (isDemoMode()) return demo.demoGetCourse(courseId, userId);
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).single();
  if (error) return null;
  return data as Course;
}

export async function assertCourseStaff(courseId: string, userId: string) {
  if (isDemoMode()) {
    const ok = await demo.demoIsCourseStaff(courseId, userId);
    if (!ok) throw new Error("Forbidden");
    return;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_staff")
    .select("course_id")
    .eq("course_id", courseId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export async function listCourseStudents(courseId: string): Promise<Student[]> {
  if (isDemoMode()) return demo.demoListCourseStudents(courseId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_students")
    .select("student:students(*, face_embeddings(student_id))")
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  type Row = {
    student:
      | (Student & { face_embeddings?: { student_id: string }[] | null })
      | null;
  };
  return ((data ?? []) as unknown as Row[]).flatMap((row) => {
    const s = row.student;
    if (!s) return [];
    return [
      {
        id: s.id,
        index_number: s.index_number,
        full_name: s.full_name,
        created_at: s.created_at,
        has_face: Array.isArray(s.face_embeddings) && s.face_embeddings.length > 0,
      },
    ];
  });
}

export async function addStudentToCourse(input: {
  courseId: string;
  index_number: string;
  full_name: string;
}): Promise<Student> {
  if (isDemoMode()) return demo.demoAddStudentToCourse(input);

  const supabase = await createClient();
  const index = input.index_number.trim().toUpperCase();
  let studentId: string;

  const { data: existing } = await supabase
    .from("students")
    .select("*")
    .eq("index_number", index)
    .maybeSingle();

  if (existing) {
    studentId = existing.id;
    if (input.full_name.trim()) {
      await supabase.from("students").update({ full_name: input.full_name.trim() }).eq("id", studentId);
    }
  } else {
    const { data, error } = await supabase
      .from("students")
      .insert({ index_number: index, full_name: input.full_name.trim() })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    studentId = data.id;
  }

  await supabase.from("course_students").upsert({
    course_id: input.courseId,
    student_id: studentId,
  });

  const { data: student } = await supabase.from("students").select("*").eq("id", studentId).single();
  const { data: face } = await supabase
    .from("face_embeddings")
    .select("student_id")
    .eq("student_id", studentId)
    .maybeSingle();

  return { ...(student as Student), has_face: !!face };
}

export async function enrollFace(studentId: string, embedding: number[]) {
  if (isDemoMode()) return demo.demoEnrollFace(studentId, embedding);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("face_embeddings")
    .upsert({ student_id: studentId, embedding, enrolled_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createSession(input: {
  course_id: string;
  started_by: string;
  lat: number;
  lng: number;
  radius_m: number;
  ends_at?: string | null;
}): Promise<Session> {
  if (isDemoMode()) return demo.demoCreateSession(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      course_id: input.course_id,
      started_by: input.started_by,
      lat: input.lat,
      lng: input.lng,
      radius_m: input.radius_m,
      ends_at: input.ends_at ?? null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  if (isDemoMode()) return demo.demoGetSession(sessionId);
  // Service role for public check-in path; staff path also works with user client.
  try {
    const service = createServiceRoleClient();
    const { data } = await service.from("sessions").select("*").eq("id", sessionId).maybeSingle();
    return (data as Session) ?? null;
  } catch {
    const supabase = await createClient();
    const { data } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
    return (data as Session) ?? null;
  }
}

export async function listSessions(courseId: string): Promise<Session[]> {
  if (isDemoMode()) return demo.demoListSessions(courseId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("course_id", courseId)
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Session[];
}

export async function endSession(sessionId: string): Promise<Session> {
  if (isDemoMode()) return demo.demoEndSession(sessionId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .update({ status: "ended", ends_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Session;
}

export async function findStudentByIndex(indexNumber: string): Promise<Student | null> {
  if (isDemoMode()) return demo.demoFindStudentByIndex(indexNumber);
  const service = createServiceRoleClient();
  const { data } = await service
    .from("students")
    .select("*")
    .eq("index_number", indexNumber.trim().toUpperCase())
    .maybeSingle();
  return (data as Student) ?? null;
}

export async function getFaceEmbedding(studentId: string) {
  if (isDemoMode()) return demo.demoGetFaceEmbedding(studentId);
  const service = createServiceRoleClient();
  const { data } = await service
    .from("face_embeddings")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  return data;
}

export async function recordAttendance(input: {
  session_id: string;
  student_id: string;
  device_hash: string;
}): Promise<AttendanceRecord> {
  if (isDemoMode()) return demo.demoRecordAttendance(input);
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("attendance")
    .insert(input)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("device_hash")) {
        throw Object.assign(new Error("This device already checked in for this session"), {
          code: "DUPLICATE_DEVICE",
        });
      }
      throw Object.assign(new Error("This index number already checked in for this session"), {
        code: "DUPLICATE_INDEX",
      });
    }
    throw new Error(error.message);
  }
  return data as AttendanceRecord;
}

export async function listAttendance(sessionId: string): Promise<AttendanceRecord[]> {
  if (isDemoMode()) return demo.demoListAttendance(sessionId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("*, student:students(index_number, full_name)")
    .eq("session_id", sessionId)
    .order("checked_in_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row: AttendanceRecord & { student?: { index_number: string; full_name: string } }) => ({
      id: row.id,
      session_id: row.session_id,
      student_id: row.student_id,
      device_hash: row.device_hash,
      checked_in_at: row.checked_in_at,
      index_number: row.student?.index_number,
      full_name: row.student?.full_name,
    }),
  );
}
