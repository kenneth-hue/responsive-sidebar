import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/current-user";
import { createCourse, listCourses } from "@/lib/db/repository";

export async function GET() {
  try {
    const user = await requireStaff();
    const courses = await listCourses(user.id);
    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

const createSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
});

export async function POST(request: Request) {
  try {
    const user = await requireStaff();
    const body = createSchema.parse(await request.json());
    const course = await createCourse({
      code: body.code,
      name: body.name,
      created_by: user.id,
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create course";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
