import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/current-user";
import {
  addStudentToCourse,
  assertCourseStaff,
  listCourseStudents,
} from "@/lib/db/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  try {
    const user = await requireStaff();
    const { courseId } = await context.params;
    await assertCourseStaff(courseId, user.id);
    const students = await listCourseStudents(courseId);
    return NextResponse.json({ students });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

const schema = z.object({
  index_number: z.string().min(2).max(32),
  full_name: z.string().min(2).max(120),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  try {
    const user = await requireStaff();
    const { courseId } = await context.params;
    await assertCourseStaff(courseId, user.id);
    const body = schema.parse(await request.json());
    const student = await addStudentToCourse({
      courseId,
      index_number: body.index_number,
      full_name: body.full_name,
    });
    return NextResponse.json({ student }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
