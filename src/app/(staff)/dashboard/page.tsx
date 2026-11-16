import Link from "next/link";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/StaffShell";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { listCourses } from "@/lib/db/repository";

export default async function DashboardPage() {
  const user = await getCurrentStaff();
  if (!user) redirect("/login");
  const courses = await listCourses(user.id);

  return (
    <StaffShell user={user}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-4xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Your courses
          </h1>
          <p className="mt-2 text-[var(--ink-muted)]">
            Create a course, enroll student faces, then start a timed session.
          </p>
        </div>
        <Link href="/courses/new" className="btn btn-primary">
          New course
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="panel fade-up rounded-2xl p-8 text-center">
          <p className="text-[var(--ink-muted)]">No courses yet.</p>
          <Link href="/courses/new" className="btn btn-primary mt-4">
            Create your first course
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((course, i) => (
            <li
              key={course.id}
              className="panel fade-up rounded-2xl p-5 transition hover:-translate-y-0.5"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <Link href={`/courses/${course.id}`} className="block">
                <div className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
                  {course.code}
                </div>
                <div
                  className="mt-1 text-2xl font-semibold"
                  style={{ fontFamily: "var(--font-display), serif" }}
                >
                  {course.name}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </StaffShell>
  );
}
