-- Presence: class attendance schema
-- Staff (lecturers/TAs) authenticate via Supabase Auth.
-- Students never have auth accounts. Face embeddings only — never images/video/passwords.

create extension if not exists "pgcrypto";

create type public.staff_role as enum ('lecturer', 'ta');
create type public.session_status as enum ('active', 'ended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.staff_role not null default 'lecturer',
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.course_staff (
  course_id uuid not null references public.courses (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (course_id, profile_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  index_number text not null unique,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table public.course_students (
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  primary key (course_id, student_id)
);

-- Store face embeddings only (float arrays). Never store images, video, or passwords for students.
create table public.face_embeddings (
  student_id uuid primary key references public.students (id) on delete cascade,
  embedding double precision[] not null,
  enrolled_at timestamptz not null default now(),
  constraint embedding_dims check (cardinality(embedding) = 128)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  started_by uuid not null references public.profiles (id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status public.session_status not null default 'active',
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 100,
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  device_hash text not null,
  checked_in_at timestamptz not null default now(),
  unique (session_id, student_id),
  unique (session_id, device_hash)
);

create index attendance_session_idx on public.attendance (session_id);
create index sessions_course_idx on public.sessions (course_id);
create index course_staff_profile_idx on public.course_staff (profile_id);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_staff enable row level security;
alter table public.students enable row level security;
alter table public.course_students enable row level security;
alter table public.face_embeddings enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;

create or replace function public.is_course_staff(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.course_staff cs
    where cs.course_id = cid and cs.profile_id = auth.uid()
  );
$$;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "courses_select_staff"
  on public.courses for select
  using (public.is_course_staff(id) or created_by = auth.uid());

create policy "courses_insert_authenticated"
  on public.courses for insert
  with check (auth.uid() = created_by);

create policy "course_staff_select"
  on public.course_staff for select
  using (profile_id = auth.uid() or public.is_course_staff(course_id));

create policy "course_staff_insert"
  on public.course_staff for insert
  with check (
    exists (select 1 from public.courses c where c.id = course_id and c.created_by = auth.uid())
  );

create policy "students_select_staff"
  on public.students for select
  using (
    exists (
      select 1 from public.course_students cst
      join public.course_staff cs on cs.course_id = cst.course_id
      where cst.student_id = students.id and cs.profile_id = auth.uid()
    )
  );

create policy "students_insert_staff"
  on public.students for insert
  with check (auth.role() = 'authenticated');

create policy "course_students_select"
  on public.course_students for select
  using (public.is_course_staff(course_id));

create policy "course_students_insert"
  on public.course_students for insert
  with check (public.is_course_staff(course_id));

create policy "face_embeddings_select_staff"
  on public.face_embeddings for select
  using (
    exists (
      select 1 from public.course_students cst
      join public.course_staff cs on cs.course_id = cst.course_id
      where cst.student_id = face_embeddings.student_id and cs.profile_id = auth.uid()
    )
  );

create policy "face_embeddings_insert_staff"
  on public.face_embeddings for insert
  with check (
    exists (
      select 1 from public.course_students cst
      join public.course_staff cs on cs.course_id = cst.course_id
      where cst.student_id = face_embeddings.student_id and cs.profile_id = auth.uid()
    )
  );

create policy "sessions_select_staff"
  on public.sessions for select
  using (public.is_course_staff(course_id));

create policy "sessions_insert_staff"
  on public.sessions for insert
  with check (public.is_course_staff(course_id) and started_by = auth.uid());

create policy "sessions_update_staff"
  on public.sessions for update
  using (public.is_course_staff(course_id));

create policy "attendance_select_staff"
  on public.attendance for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = attendance.session_id and public.is_course_staff(s.course_id)
    )
  );

-- Attendance inserts go through service-role check-in API (students have no auth).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Staff'),
    coalesce((new.raw_user_meta_data->>'role')::public.staff_role, 'lecturer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
