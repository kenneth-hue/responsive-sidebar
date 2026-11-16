import { promises as fs } from "fs";
import path from "path";
import { randomUUID, scryptSync, timingSafeEqual, randomBytes } from "crypto";
import type {
  AttendanceRecord,
  Course,
  FaceEmbedding,
  Profile,
  Session,
  StaffRole,
  Student,
} from "@/lib/types";

const DATA_PATH = path.join(process.cwd(), ".data", "demo-store.json");

interface DemoUser {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  full_name: string;
  role: StaffRole;
  created_at: string;
}

interface DemoStoreData {
  users: DemoUser[];
  profiles: Profile[];
  courses: Course[];
  course_staff: { course_id: string; profile_id: string }[];
  students: Student[];
  course_students: { course_id: string; student_id: string }[];
  face_embeddings: FaceEmbedding[];
  sessions: Session[];
  attendance: AttendanceRecord[];
}

let memory: DemoStoreData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function emptyStore(): DemoStoreData {
  return {
    users: [],
    profiles: [],
    courses: [],
    course_staff: [],
    students: [],
    course_students: [],
    face_embeddings: [],
    sessions: [],
    attendance: [],
  };
}

async function ensureLoaded(): Promise<DemoStoreData> {
  if (memory) return memory;
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    memory = JSON.parse(raw) as DemoStoreData;
  } catch {
    memory = emptyStore();
    await persist();
  }
  return memory!;
}

async function persist(): Promise<void> {
  const data = memory ?? emptyStore();
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  });
  await writeQueue;
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export async function demoSignup(input: {
  email: string;
  password: string;
  full_name: string;
  role: StaffRole;
}): Promise<{ user: { id: string; email: string; full_name: string; role: StaffRole } }> {
  const store = await ensureLoaded();
  const email = input.email.toLowerCase().trim();
  if (store.users.some((u) => u.email === email)) {
    throw new Error("An account with this email already exists");
  }
  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  const id = randomUUID();
  const salt = randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const user: DemoUser = {
    id,
    email,
    password_hash: hashPassword(input.password, salt),
    password_salt: salt,
    full_name: input.full_name.trim(),
    role: input.role,
    created_at: now,
  };
  store.users.push(user);
  store.profiles.push({
    id,
    full_name: user.full_name,
    role: user.role,
    created_at: now,
  });
  await persist();
  return { user: { id, email, full_name: user.full_name, role: user.role } };
}

export async function demoLogin(email: string, password: string) {
  const store = await ensureLoaded();
  const user = store.users.find((u) => u.email === email.toLowerCase().trim());
  if (!user) throw new Error("Invalid email or password");
  const hash = hashPassword(password, user.password_salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.password_hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid email or password");
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  };
}

export async function demoGetProfile(userId: string): Promise<Profile | null> {
  const store = await ensureLoaded();
  return store.profiles.find((p) => p.id === userId) ?? null;
}

export async function demoListCourses(userId: string): Promise<Course[]> {
  const store = await ensureLoaded();
  const ids = new Set(
    store.course_staff.filter((c) => c.profile_id === userId).map((c) => c.course_id),
  );
  return store.courses.filter((c) => ids.has(c.id) || c.created_by === userId);
}

export async function demoCreateCourse(input: {
  code: string;
  name: string;
  created_by: string;
}): Promise<Course> {
  const store = await ensureLoaded();
  const course: Course = {
    id: randomUUID(),
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    created_by: input.created_by,
    created_at: new Date().toISOString(),
  };
  store.courses.push(course);
  store.course_staff.push({ course_id: course.id, profile_id: input.created_by });
  await persist();
  return course;
}

export async function demoGetCourse(courseId: string, userId: string): Promise<Course | null> {
  const store = await ensureLoaded();
  const course = store.courses.find((c) => c.id === courseId);
  if (!course) return null;
  const isStaff = store.course_staff.some(
    (c) => c.course_id === courseId && c.profile_id === userId,
  );
  if (!isStaff && course.created_by !== userId) return null;
  return course;
}

export async function demoIsCourseStaff(courseId: string, userId: string): Promise<boolean> {
  const store = await ensureLoaded();
  return store.course_staff.some((c) => c.course_id === courseId && c.profile_id === userId);
}

export async function demoListCourseStudents(courseId: string): Promise<Student[]> {
  const store = await ensureLoaded();
  const studentIds = new Set(
    store.course_students.filter((c) => c.course_id === courseId).map((c) => c.student_id),
  );
  const faceSet = new Set(store.face_embeddings.map((f) => f.student_id));
  return store.students
    .filter((s) => studentIds.has(s.id))
    .map((s) => ({ ...s, has_face: faceSet.has(s.id) }));
}

export async function demoAddStudentToCourse(input: {
  courseId: string;
  index_number: string;
  full_name: string;
}): Promise<Student> {
  const store = await ensureLoaded();
  const index = input.index_number.trim().toUpperCase();
  let student = store.students.find((s) => s.index_number === index);
  if (!student) {
    student = {
      id: randomUUID(),
      index_number: index,
      full_name: input.full_name.trim(),
      created_at: new Date().toISOString(),
    };
    store.students.push(student);
  } else if (input.full_name.trim()) {
    student.full_name = input.full_name.trim();
  }
  const linked = store.course_students.some(
    (c) => c.course_id === input.courseId && c.student_id === student!.id,
  );
  if (!linked) {
    store.course_students.push({ course_id: input.courseId, student_id: student.id });
  }
  await persist();
  const has_face = store.face_embeddings.some((f) => f.student_id === student!.id);
  return { ...student, has_face };
}

export async function demoEnrollFace(studentId: string, embedding: number[]): Promise<FaceEmbedding> {
  const store = await ensureLoaded();
  const student = store.students.find((s) => s.id === studentId);
  if (!student) throw new Error("Student not found");
  const row: FaceEmbedding = {
    student_id: studentId,
    embedding,
    enrolled_at: new Date().toISOString(),
  };
  store.face_embeddings = store.face_embeddings.filter((f) => f.student_id !== studentId);
  store.face_embeddings.push(row);
  await persist();
  return row;
}

export async function demoFindStudentByIndex(indexNumber: string): Promise<Student | null> {
  const store = await ensureLoaded();
  return (
    store.students.find((s) => s.index_number === indexNumber.trim().toUpperCase()) ?? null
  );
}

export async function demoGetFaceEmbedding(studentId: string): Promise<FaceEmbedding | null> {
  const store = await ensureLoaded();
  return store.face_embeddings.find((f) => f.student_id === studentId) ?? null;
}

export async function demoCreateSession(input: {
  course_id: string;
  started_by: string;
  lat: number;
  lng: number;
  radius_m: number;
  ends_at?: string | null;
}): Promise<Session> {
  const store = await ensureLoaded();
  const session: Session = {
    id: randomUUID(),
    course_id: input.course_id,
    started_by: input.started_by,
    starts_at: new Date().toISOString(),
    ends_at: input.ends_at ?? null,
    status: "active",
    lat: input.lat,
    lng: input.lng,
    radius_m: input.radius_m,
    created_at: new Date().toISOString(),
  };
  store.sessions.push(session);
  await persist();
  return session;
}

export async function demoGetSession(sessionId: string): Promise<Session | null> {
  const store = await ensureLoaded();
  return store.sessions.find((s) => s.id === sessionId) ?? null;
}

export async function demoListSessions(courseId: string): Promise<Session[]> {
  const store = await ensureLoaded();
  return store.sessions
    .filter((s) => s.course_id === courseId)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
}

export async function demoEndSession(sessionId: string): Promise<Session> {
  const store = await ensureLoaded();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("Session not found");
  session.status = "ended";
  session.ends_at = new Date().toISOString();
  await persist();
  return session;
}

export async function demoRecordAttendance(input: {
  session_id: string;
  student_id: string;
  device_hash: string;
}): Promise<AttendanceRecord> {
  const store = await ensureLoaded();
  if (store.attendance.some((a) => a.session_id === input.session_id && a.student_id === input.student_id)) {
    throw Object.assign(new Error("This index number already checked in for this session"), {
      code: "DUPLICATE_INDEX",
    });
  }
  if (store.attendance.some((a) => a.session_id === input.session_id && a.device_hash === input.device_hash)) {
    throw Object.assign(new Error("This device already checked in for this session"), {
      code: "DUPLICATE_DEVICE",
    });
  }
  const record: AttendanceRecord = {
    id: randomUUID(),
    session_id: input.session_id,
    student_id: input.student_id,
    device_hash: input.device_hash,
    checked_in_at: new Date().toISOString(),
  };
  store.attendance.push(record);
  await persist();
  return record;
}

export async function demoListAttendance(sessionId: string): Promise<AttendanceRecord[]> {
  const store = await ensureLoaded();
  return store.attendance
    .filter((a) => a.session_id === sessionId)
    .map((a) => {
      const student = store.students.find((s) => s.id === a.student_id);
      return {
        ...a,
        index_number: student?.index_number,
        full_name: student?.full_name,
      };
    })
    .sort((a, b) => a.checked_in_at.localeCompare(b.checked_in_at));
}
