import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/current-user";
import { assertCourseStaff, getSession, listAttendance } from "@/lib/db/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireStaff();
    const { sessionId } = await context.params;
    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertCourseStaff(session.course_id, user.id);
    const attendance = await listAttendance(sessionId);
    return NextResponse.json({ attendance, session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
