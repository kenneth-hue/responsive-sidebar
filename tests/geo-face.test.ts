import assert from "node:assert/strict";
import { withinRadius } from "../src/lib/geo/haversine";
import { cosineSimilarity, l2Normalize } from "../src/lib/face/embedding";
import { verifyLiveness } from "../src/lib/face/liveness";

const near = withinRadius(5.6505, -0.1865, 5.6506, -0.1866, 100);
assert.equal(near.ok, true);

const far = withinRadius(5.6505, -0.1865, 5.7, -0.2, 100);
assert.equal(far.ok, false);

const a = l2Normalize([1, 0, 0, 1]);
const b = l2Normalize([1, 0, 0, 1]);
assert.ok(cosineSimilarity(a, b) > 0.99);

const live = verifyLiveness({
  challengeId: "abcdefgh",
  motionScore: 0.1,
  frameCount: 10,
  completedAt: Date.now(),
});
assert.equal(live.ok, true);

const dead = verifyLiveness({
  challengeId: "abcdefgh",
  motionScore: 0.001,
  frameCount: 10,
  completedAt: Date.now(),
});
assert.equal(dead.ok, false);

console.log("geo-face.test.ts passed");
