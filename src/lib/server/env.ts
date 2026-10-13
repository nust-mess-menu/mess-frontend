import "server-only";

/**
 * Server-only configuration for the admin backend-for-frontend.
 *
 * These secrets never reach the browser: the "server-only" import makes any
 * accidental client import a build error. Validation is lazy (first use) so
 * `next build` works without production secrets, but a production request
 * with a missing or weak secret fails loudly instead of running insecurely.
 */

export interface ServerEnv {
  isProduction: boolean;
  // Origin the admin console is served from. Admin pages and APIs answer only
  // on this host, and admin mutations must carry it as their Origin.
  adminOrigin: string;
  adminHost: string;
  // Student site host when it differs from the admin host (split deployment):
  // the admin host then serves only the admin, keeping third-party student
  // scripts off the admin origin entirely. Null for a single shared host.
  siteHost: string | null;
  // Where the BFF reaches mess-backend (server-to-server)
  backendUrl: string;
  // Credentials an admin types into /admin/login
  adminUsername: string;
  adminPassword: string;
  // Credentials the BFF presents to mess-backend's admin API
  backendAdminUsername: string;
  backendAdminPassword: string;
  // Key material for encrypting the admin session cookie
  sessionSecret: string;
  // Reverse-proxy hops whose X-Forwarded-For entries are trusted
  // Hop count behind X-Forwarded-For proxies, or "cloudflare" on Workers
  trustedProxyHops: number | "cloudflare";
}

const MIN_PASSWORD = 16;
const MIN_SESSION_SECRET = 32;
const PLACEHOLDERS = new Set(["change-me-strong-password", "changeme", "password", "admin", "secret"]);

export class ServerConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid server configuration:\n  - ${problems.join("\n  - ")}`);
    this.name = "ServerConfigError";
  }
}

function read(env: Record<string, string | undefined>, key: string): string | undefined {
  const v = env[key];
  return v && v.trim() ? v.trim() : undefined;
}

function parseOrigin(name: string, raw: string | undefined, isProduction: boolean, problems: string[]): string {
  if (!raw) {
    problems.push(`${name} is required`);
    return "";
  }
  try {
    const url = new URL(raw);
    // http is tolerated only for loopback hosts (local production testing),
    // which no remote party can reach
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (isProduction && url.protocol !== "https:" && !loopback) problems.push(`${name} must use https in production`);
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
      problems.push(`${name} must be a bare origin (no path, query or credentials)`);
    }
    return url.origin;
  } catch {
    problems.push(`${name} is not a valid URL`);
    return "";
  }
}

function checkSecret(name: string, value: string | undefined, min: number, isProduction: boolean, problems: string[]): string {
  if (!value) {
    problems.push(`${name} is required`);
    return "";
  }
  if (isProduction) {
    if (value.length < min) problems.push(`${name} must be at least ${min} characters in production`);
    if (PLACEHOLDERS.has(value.toLowerCase())) problems.push(`${name} is still a placeholder`);
    // Length alone accepts "aaaaaaaaaaaaaaaa"; require some variety too
    if (new Set(value).size < 10) problems.push(`${name} is too repetitive - use a randomly generated value`);
  }
  return value;
}

export function loadServerEnv(env: Record<string, string | undefined> = process.env): ServerEnv {
  const problems: string[] = [];
  const isProduction = env.NODE_ENV === "production";

  const adminOrigin = parseOrigin("ADMIN_URL", read(env, "ADMIN_URL"), isProduction, problems);
  const siteRaw = read(env, "SITE_URL");
  const siteOrigin = siteRaw ? parseOrigin("SITE_URL", siteRaw, isProduction, problems) : null;
  const backendUrl = parseOrigin(
    "BACKEND_URL",
    read(env, "BACKEND_URL") ?? read(env, "NEXT_PUBLIC_API_BASE_URL"),
    isProduction,
    problems
  );

  const adminUsername = read(env, "ADMIN_USERNAME") ?? "";
  if (!adminUsername) problems.push("ADMIN_USERNAME is required");
  // Passwords are deliberately not trimmed
  const adminPassword = checkSecret("ADMIN_PASSWORD", env.ADMIN_PASSWORD, MIN_PASSWORD, isProduction, problems);
  if (isProduction && adminUsername && adminPassword.toLowerCase().includes(adminUsername.toLowerCase())) {
    problems.push("ADMIN_PASSWORD must not contain the username");
  }

  const backendAdminUsername = read(env, "BACKEND_ADMIN_USERNAME") ?? "";
  if (!backendAdminUsername) problems.push("BACKEND_ADMIN_USERNAME is required");
  if (backendAdminUsername.includes(":")) problems.push('BACKEND_ADMIN_USERNAME must not contain ":"');
  const backendAdminPassword = checkSecret(
    "BACKEND_ADMIN_PASSWORD",
    env.BACKEND_ADMIN_PASSWORD,
    MIN_PASSWORD,
    isProduction,
    problems
  );

  const sessionSecret = checkSecret("SESSION_SECRET", env.SESSION_SECRET, MIN_SESSION_SECRET, true, problems);

  // No default in production: getting this wrong either makes client IPs
  // spoofable (too high) or disables per-IP sign-in throttling (0)
  const hopsRaw = read(env, "TRUSTED_PROXY_HOPS") ?? (isProduction ? undefined : "0");
  if (hopsRaw === undefined) {
    problems.push('TRUSTED_PROXY_HOPS is required in production ("cloudflare" on Workers, 1 on Vercel, 0 if exposed directly)');
  }
  const trustedProxyHops: number | "cloudflare" = hopsRaw === "cloudflare" ? "cloudflare" : Number(hopsRaw ?? "0");
  if (
    trustedProxyHops !== "cloudflare" &&
    (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0 || trustedProxyHops > 5)
  ) {
    problems.push('TRUSTED_PROXY_HOPS must be "cloudflare" or an integer between 0 and 5');
  }

  if (problems.length) throw new ServerConfigError(problems);

  return {
    isProduction,
    adminOrigin,
    adminHost: new URL(adminOrigin).host.toLowerCase(),
    siteHost: siteOrigin && new URL(siteOrigin).host.toLowerCase() !== new URL(adminOrigin).host.toLowerCase()
      ? new URL(siteOrigin).host.toLowerCase()
      : null,
    backendUrl,
    adminUsername,
    adminPassword,
    backendAdminUsername,
    backendAdminPassword,
    sessionSecret,
    trustedProxyHops,
  };
}

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (!cached) cached = loadServerEnv();
  return cached;
}

/** Tests only. */
export function resetServerEnvForTests(): void {
  cached = null;
}
