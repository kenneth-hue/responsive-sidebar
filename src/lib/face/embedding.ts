import sharp from "sharp";
import { createHash } from "crypto";
import { FACE_EMBEDDING_SIZE } from "@/lib/config";

/**
 * Derive a fixed-size face embedding from an image buffer.
 * Production deployments should swap this for a real face model (e.g. InsightFace / face-api).
 * Images are processed in-memory and never written to disk.
 */
export async function extractFaceEmbedding(imageBuffer: Buffer): Promise<number[]> {
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .greyscale()
    .resize(16, 16, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width * info.height !== 256) {
    throw new Error("Failed to normalize face capture");
  }

  const pixels = Array.from(data.values()).map((v) => v / 255);
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  const centered = pixels.map((v) => v - mean);

  // Expand 256 luminance samples into a 128-d descriptor via paired averages + local contrast.
  const embedding = new Array<number>(FACE_EMBEDDING_SIZE);
  for (let i = 0; i < FACE_EMBEDDING_SIZE; i++) {
    const a = centered[i * 2];
    const b = centered[i * 2 + 1];
    embedding[i] = (a + b) / 2 + (a - b) * 0.25;
  }

  return l2Normalize(embedding);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

/** Hash embedding for logging without exposing the vector. */
export function embeddingFingerprint(embedding: number[]): string {
  return createHash("sha256")
    .update(embedding.map((x) => x.toFixed(6)).join(","))
    .digest("hex")
    .slice(0, 12);
}
