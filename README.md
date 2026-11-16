# Presence — Class Attendance

Next.js + Supabase attendance app for **lecturers and TAs only**. Students never create accounts or log in.

## How it works

1. Staff sign up / log in and create a course roster.
2. Staff enroll each student’s **face embedding** (images are discarded; vectors only).
3. Lecturer starts a timed session and saves classroom GPS.
4. A **rotating HMAC-signed QR** (30s expiry) is shown on the projector.
5. Students scan, enter index number, pass **liveness + face match + location**, and are recorded once per index and once per device.
6. When the session ends, staff view the table and **download CSV**.

## Quick start (demo mode)

Demo mode uses a local JSON store when Supabase env vars are unset.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create a staff account, and walk through a course session.

## Supabase production

1. Create a Supabase project.
2. Run [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) in the SQL editor.
3. Set in `.env.local`:

```env
ATTENDANCE_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
QR_HMAC_SECRET=long-random-secret
NEXT_PUBLIC_APP_URL=https://your-domain
```

Service role is used only for the public check-in API (students have no auth).

## Privacy rules enforced

- No student passwords or auth accounts
- Face **embeddings only** — capture bytes are never written to storage
- No video retention
- QR tokens expire in 30 seconds
- One check-in per index number per session
- One check-in per device per session

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm test
```
