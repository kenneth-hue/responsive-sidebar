import { createHash } from "crypto";

export function hashDeviceId(deviceId: string): string {
  return createHash("sha256").update(deviceId).digest("hex");
}
