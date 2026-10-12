/**
 * localStorage wrappers that never throw (private mode, blocked storage, SSR).
 */
export function getItem(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked */
  }
}

export function removeItem(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
}

/** Parse JSON from storage, discarding anything malformed instead of crashing. */
export function getJson<T>(key: string): T | null {
  const raw = getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    removeItem(key);
    return null;
  }
}
