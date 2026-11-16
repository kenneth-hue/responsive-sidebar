import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/current-user";
import { assertCourseStaff, endSession, getSession } from "@/lib/db/repository";

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
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireStaff();
    const { sessionId } = await context.params;
    const body = await request.json();
    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertCourseStaff(session.course_id, user.id);

    if (body.action === "end") {
      const updated = await endSession(sessionId);
      return NextResponse.json({ session: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
