import { requireStaff } from "@/lib/auth/current-user";
import { assertCourseStaff, getSession, listAttendance } from "@/lib/db/repository";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireStaff();
    const { sessionId } = await context.params;
    const session = await getSession(sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }
    await assertCourseStaff(session.course_id, user.id);
    const attendance = await listAttendance(sessionId);

    const lines = [
      "index_number,full_name,checked_in_at",
      ...attendance.map((row) =>
        [
          csvEscape(row.index_number ?? ""),
          csvEscape(row.full_name ?? ""),
          csvEscape(row.checked_in_at),
        ].join(","),
      ),
    ];

    return new Response(lines.join("\n") + "\n", {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${sessionId.slice(0, 8)}.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
