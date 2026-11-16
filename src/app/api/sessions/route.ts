import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/current-user";
import { assertCourseStaff, createSession, listSessions } from "@/lib/db/repository";
import { DEFAULT_RADIUS_M } from "@/lib/config";

export async function GET(request: Request) {
  try {
    const user = await requireStaff();
    const courseId = new URL(request.url).searchParams.get("courseId");
    if (!courseId) {
      return NextResponse.json({ error: "courseId required" }, { status: 400 });
    }
    await assertCourseStaff(courseId, user.id);
    const sessions = await listSessions(courseId);
    return NextResponse.json({ sessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

const schema = z.object({
  course_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(20).max(1000).optional(),
  ends_at: z.string().datetime().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireStaff();
    const body = schema.parse(await request.json());
    await assertCourseStaff(body.course_id, user.id);
    const session = await createSession({
      course_id: body.course_id,
      started_by: user.id,
      lat: body.lat,
      lng: body.lng,
      radius_m: body.radius_m ?? DEFAULT_RADIUS_M,
      ends_at: body.ends_at ?? null,
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start session";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
