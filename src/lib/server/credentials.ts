import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time equality over SHA-256 digests (no length leak, no early exit). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export function checkAdminCredentials(
  username: string,
  password: string,
  expected: { username: string; password: string }
): boolean {
  // Evaluate both, always, so timing does not reveal which one was wrong
  const userOk = safeEqual(username, expected.username);
  const passOk = safeEqual(password, expected.password);
  return userOk && passOk;
}
