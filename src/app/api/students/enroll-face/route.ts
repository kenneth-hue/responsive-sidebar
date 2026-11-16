import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/current-user";
import { assertCourseStaff, enrollFace } from "@/lib/db/repository";
import { extractFaceEmbedding } from "@/lib/face/embedding";
import { FACE_EMBEDDING_SIZE } from "@/lib/config";

export async function POST(request: Request) {
  try {
    const user = await requireStaff();
    const form = await request.formData();
    const studentId = String(form.get("studentId") ?? "");
    const courseId = String(form.get("courseId") ?? "");
    const file = form.get("image");

    if (!studentId || !courseId) {
      return NextResponse.json({ error: "studentId and courseId required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Face image required" }, { status: 400 });
    }

    await assertCourseStaff(courseId, user.id);

    const buffer = Buffer.from(await file.arrayBuffer());
    const embedding = await extractFaceEmbedding(buffer);
    if (embedding.length !== FACE_EMBEDDING_SIZE) {
      return NextResponse.json({ error: "Invalid embedding size" }, { status: 500 });
    }

    // Image buffer goes out of scope — never persisted.
    await enrollFace(studentId, embedding);

    return NextResponse.json({
      ok: true,
      student_id: studentId,
      dims: embedding.length,
      note: "Face embedding stored. Capture discarded.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrollment failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
