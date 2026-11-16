#!/usr/bin/env node
/**
 * End-to-end API smoke test against a running demo-mode server.
 */
import { createHash, createHmac } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import sharp from "sharp";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";

async function req(path, { method = "GET", body, headers = {}, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() || [];
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { res, data, setCookie };
}

function cookieFrom(setCookie) {
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function makeFaceJpeg(seed) {
  // Distinct greyscale patterns so different seeds don't match.
  const size = 128;
  const buf = Buffer.alloc(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      buf[y * size + x] = (x * 3 + y * 5 + seed * 17) % 256;
    }
  }
  return sharp(buf, { raw: { width: size, height: size, channels: 1 } })
    .jpeg()
    .toBuffer();
}

const email = `lecturer_${Date.now()}@example.com`;
const password = "password123";

console.log("1. Signup");
let { res, data, setCookie } = await req("/api/auth/signup", {
  method: "POST",
  body: { email, password, full_name: "Dr Ada", role: "lecturer" },
});
if (!res.ok) throw new Error(`signup failed: ${JSON.stringify(data)}`);
let cookie = cookieFrom(setCookie);
console.log("   ok", data.user.email);

console.log("2. Create course");
({ res, data } = await req("/api/courses", {
  method: "POST",
  cookie,
  body: { code: "CS101", name: "Intro Computing" },
}));
if (!res.ok) throw new Error(`course failed: ${JSON.stringify(data)}`);
const courseId = data.course.id;
console.log("   course", courseId);

console.log("3. Add student");
({ res, data } = await req(`/api/courses/${courseId}/students`, {
  method: "POST",
  cookie,
  body: { index_number: "IDX001", full_name: "Sam Student" },
}));
if (!res.ok) throw new Error(`student failed: ${JSON.stringify(data)}`);
const studentId = data.student.id;
console.log("   student", studentId);

console.log("4. Enroll face");
const faceA = await makeFaceJpeg(1);
const formEnroll = new FormData();
formEnroll.set("studentId", studentId);
formEnroll.set("courseId", courseId);
formEnroll.set("image", new Blob([faceA], { type: "image/jpeg" }), "enroll.jpg");
({ res, data } = await req("/api/students/enroll-face", {
  method: "POST",
  cookie,
  body: formEnroll,
}));
if (!res.ok) throw new Error(`enroll failed: ${JSON.stringify(data)}`);
console.log("   embedding dims", data.dims);

console.log("5. Start session");
({ res, data } = await req("/api/sessions", {
  method: "POST",
  cookie,
  body: { course_id: courseId, lat: 5.6505, lng: -0.1865, radius_m: 100 },
}));
if (!res.ok) throw new Error(`session failed: ${JSON.stringify(data)}`);
const sessionId = data.session.id;
console.log("   session", sessionId);

console.log("6. Get QR");
({ res, data } = await req(`/api/sessions/${sessionId}/qr`, { cookie }));
if (!res.ok) throw new Error(`qr failed: ${JSON.stringify(data)}`);
const token = data.token;
console.log("   token ttl", data.expiresIn);

console.log("7. Check-in");
const formCheck = new FormData();
formCheck.set("token", token);
formCheck.set("index_number", "IDX001");
formCheck.set("lat", "5.6505");
formCheck.set("lng", "-0.1865");
formCheck.set(
  "liveness",
  JSON.stringify({
    challengeId: "challenge-demo-1",
    motionScore: 0.12,
    frameCount: 12,
    completedAt: Date.now(),
  }),
);
formCheck.set("image", new Blob([faceA], { type: "image/jpeg" }), "checkin.jpg");
({ res, data, setCookie } = await req("/api/check-in", { method: "POST", body: formCheck }));
if (!res.ok) throw new Error(`check-in failed: ${JSON.stringify(data)}`);
const deviceCookie = cookieFrom(setCookie);
console.log("   checked in", data.index_number, data.match_score);

console.log("8. Duplicate index rejected");
({ res, data } = await req("/api/check-in", { method: "POST", body: formCheck }));
if (res.status !== 409) throw new Error(`expected duplicate index 409, got ${res.status}`);
console.log("   ok", data.code);

console.log("9. Expired QR rejected");
const parts = token.split(".");
const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
payload.iat -= 60;
payload.exp = payload.iat + 30;
const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
const secret = process.env.QR_HMAC_SECRET || "dev-qr-hmac-secret-change-me";
const sig = createHmac("sha256", secret).update(body).digest("base64url");
const expiredForm = new FormData();
expiredForm.set("token", `${body}.${sig}`);
expiredForm.set("index_number", "IDX002");
expiredForm.set("lat", "5.6505");
expiredForm.set("lng", "-0.1865");
expiredForm.set(
  "liveness",
  JSON.stringify({
    challengeId: "challenge-demo-2",
    motionScore: 0.12,
    frameCount: 12,
    completedAt: Date.now(),
  }),
);
expiredForm.set("image", new Blob([faceA], { type: "image/jpeg" }), "checkin.jpg");
({ res, data } = await req("/api/check-in", { method: "POST", body: expiredForm }));
if (res.ok) throw new Error("expired QR should fail");
console.log("   ok", data.code || data.error);

console.log("10. End session + CSV");
({ res, data } = await req(`/api/sessions/${sessionId}`, {
  method: "PATCH",
  cookie,
  body: { action: "end" },
}));
if (!res.ok) throw new Error(`end failed: ${JSON.stringify(data)}`);
({ res, data } = await req(`/api/sessions/${sessionId}/csv`, { cookie }));
if (!res.ok) throw new Error("csv failed");
if (!String(data).includes("IDX001")) throw new Error("csv missing student");
console.log("   csv lines", String(data).trim().split("\n").length);

console.log("\nE2E demo passed.");
void createHash; // silence unused in some bundlers
void readFileSync;
void writeFileSync;
void mkdirSync;
