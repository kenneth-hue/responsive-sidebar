import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StaffShell } from "@/components/StaffShell";
import { LiveSessionClient } from "@/components/sessions/LiveSessionClient";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { assertCourseStaff, getCourse, getSession } from "@/lib/db/repository";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentStaff();
  if (!user) redirect("/login");
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) notFound();

  try {
    await assertCourseStaff(session.course_id, user.id);
  } catch {
    redirect("/dashboard");
  }

  const course = await getCourse(session.course_id, user.id);

  return (
    <StaffShell user={user}>
      <Link href={`/courses/${session.course_id}`} className="text-sm text-[var(--ink-muted)]">
        ← {course?.code ?? "Course"}
      </Link>
      <h1
        className="mb-6 mt-2 text-4xl font-semibold"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        Attendance session
      </h1>
      <LiveSessionClient session={session} />
    </StaffShell>
  );
}
