import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { createQrToken, verifyQrToken } from "../src/lib/qr/token";

process.env.QR_HMAC_SECRET = "test-secret";

const token = createQrToken("550e8400-e29b-41d4-a716-446655440000", 30);
const ok = verifyQrToken(token);
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.payload.session_id, "550e8400-e29b-41d4-a716-446655440000");
  assert.ok(ok.payload.exp - ok.payload.iat <= 30);
}

const bad = verifyQrToken(token.slice(0, -2) + "ab");
assert.equal(bad.ok, false);

const parts = token.split(".");
const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
payload.iat = Math.floor(Date.now() / 1000) - 60;
payload.exp = payload.iat + 30;
const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
const sig = createHmac("sha256", "test-secret").update(body).digest("base64url");
const expired = verifyQrToken(`${body}.${sig}`);
assert.equal(expired.ok, false);

console.log("qr-token.test.ts passed");
