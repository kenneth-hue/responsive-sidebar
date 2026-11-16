import { redirect } from "next/navigation";
import { StaffShell } from "@/components/StaffShell";
import { NewCourseForm } from "@/components/courses/NewCourseForm";
import { getCurrentStaff } from "@/lib/auth/current-user";

export default async function NewCoursePage() {
  const user = await getCurrentStaff();
  if (!user) redirect("/login");

  return (
    <StaffShell user={user}>
      <h1
        className="mb-6 text-4xl font-semibold"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        New course
      </h1>
      <NewCourseForm />
    </StaffShell>
  );
}
