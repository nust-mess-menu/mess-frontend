/**
 * Review avatars.
 *
 * Reviews are shown under a generated username instead of a real name, and each
 * one gets a stock avatar picked deterministically from that username, so a
 * given person looks the same everywhere. No real profile photos are loaded.
 */

export const AVATARS = [
  "/avatars/avatar-1.png",
  "/avatars/avatar-2.jpeg",
  "/avatars/avatar-3.jpeg",
  "/avatars/avatar-4.jpeg",
  "/avatars/avatar-5.jpeg",
  "/avatars/avatar-6.jpeg",
] as const;

// Shown when a commenter has no generated username yet
export const ANONYMOUS_NAME = "hostelite";

export function getAvatarForId(name: string | null | undefined): string {
  if (!name) return AVATARS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100003;
  }
  return AVATARS[hash % AVATARS.length];
}

/** Only render profile photos served over https (never javascript:, data:, http:). */
export function safePhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
