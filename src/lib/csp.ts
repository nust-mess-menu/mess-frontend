/**
 * Content-Security-Policy builders.
 *
 * Scripts are locked down with a per-request nonce plus 'strict-dynamic': only
 * scripts Next.js renders with the nonce run, and whatever they load
 * (Firebase's Google sign-in helper, the feedback widget) inherits that trust.
 * No inline or injected script without the nonce can execute.
 *
 * Styles allow 'unsafe-inline' because React emits style="" attributes during
 * server rendering, which nonces cannot cover. Inline styles cannot run code.
 *
 * The admin area gets a much tighter policy: no third-party origins at all.
 */

const squash = (directives: Record<string, string[]>) =>
  Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");

interface CspOptions {
  nonce: string;
  isDev: boolean;
  // false only for loopback hosts, where https does not exist
  upgradeInsecure: boolean;
  apiOrigin: string;
  firebaseAuthDomain: string;
  userbackEnabled: boolean;
  authEmulatorOrigin?: string;
}

export function siteCsp({
  nonce,
  isDev,
  upgradeInsecure,
  apiOrigin,
  firebaseAuthDomain,
  userbackEnabled,
  authEmulatorOrigin,
}: CspOptions): string {
  const userback = userbackEnabled ? ["https://*.userback.io"] : [];
  const emulator = authEmulatorOrigin ? [authEmulatorOrigin] : [];
  return squash({
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'", ...userback],
    "img-src": ["'self'", "data:", "blob:", "https://lh3.googleusercontent.com", ...userback],
    "font-src": ["'self'", "data:", ...userback],
    "connect-src": [
      "'self'",
      apiOrigin,
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
      "https://www.googleapis.com",
      ...userback,
      ...emulator,
      ...(isDev ? ["ws:", "http://localhost:*"] : []),
    ],
    "frame-src": [`https://${firebaseAuthDomain}`, "https://accounts.google.com", ...userback, ...emulator],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'", ...userback],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(upgradeInsecure ? { "upgrade-insecure-requests": [] } : {}),
  });
}

export function adminCsp({ nonce, isDev, upgradeInsecure }: Pick<CspOptions, "nonce" | "isDev" | "upgradeInsecure">): string {
  return squash({
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(isDev ? ["ws:"] : [])],
    "frame-src": ["'none'"],
    "worker-src": ["'none'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(upgradeInsecure ? { "upgrade-insecure-requests": [] } : {}),
  });
}
