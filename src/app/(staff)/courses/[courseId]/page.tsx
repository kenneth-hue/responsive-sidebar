import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StaffShell } from "@/components/StaffShell";
import { AddStudentForm } from "@/components/courses/AddStudentForm";
import { FaceEnrollButton } from "@/components/courses/FaceEnrollButton";
import { StartSessionButton } from "@/components/courses/StartSessionButton";
import { getCurrentStaff } from "@/lib/auth/current-user";
import {
  getCourse,
  listAttendance,
  listCourseStudents,
  listSessions,
} from "@/lib/db/repository";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const user = await getCurrentStaff();
  if (!user) redirect("/login");
  const { courseId } = await params;
  const course = await getCourse(courseId, user.id);
  if (!course) notFound();

  const [students, sessions] = await Promise.all([
    listCourseStudents(courseId),
    listSessions(courseId),
  ]);

  const counts = await Promise.all(
    sessions.map(async (s) => ({
      id: s.id,
      count: (await listAttendance(s.id)).length,
    })),
  );
  const countMap = Object.fromEntries(counts.map((c) => [c.id, c.count]));

  return (
    <StaffShell user={user}>
      <Link href="/dashboard" className="text-sm text-[var(--ink-muted)]">
        ← Courses
      </Link>
      <div className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
            {course.code}
          </div>
          <h1
            className="text-4xl font-semibold"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {course.name}
          </h1>
        </div>
        <StartSessionButton courseId={course.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Roster</h2>
          <AddStudentForm courseId={course.id} />
          <ul className="mt-4 space-y-3">
            {students.map((s) => (
              <li key={s.id} className="panel rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{s.full_name}</div>
                    <div className="text-sm text-[var(--ink-muted)]">{s.index_number}</div>
                    <div className="mt-1 text-xs font-medium text-[var(--brand)]">
                      {s.has_face ? "Face enrolled" : "Face missing"}
                    </div>
                  </div>
                  {!s.has_face && (
                    <FaceEnrollButton
                      courseId={course.id}
                      studentId={s.id}
                      indexNumber={s.index_number}
                    />
                  )}
                </div>
              </li>
            ))}
            {students.length === 0 && (
              <li className="text-sm text-[var(--ink-muted)]">No students yet.</li>
            )}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Sessions</h2>
          <div className="panel overflow-hidden rounded-2xl">
            <table className="table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Status</th>
                  <th>Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link className="font-medium underline-offset-2 hover:underline" href={`/sessions/${s.id}`}>
                        {new Date(s.starts_at).toLocaleString()}
                      </Link>
                    </td>
                    <td className="capitalize">{s.status}</td>
                    <td>{countMap[s.id] ?? 0}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-[var(--ink-muted)]">
                      No sessions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
