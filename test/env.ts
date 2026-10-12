import { resetServerEnvForTests } from "@/lib/server/env";

export const ENV = {
  NODE_ENV: "production",
  ADMIN_URL: "https://mess.example.edu",
  BACKEND_URL: "https://api.example.edu",
  ADMIN_USERNAME: "menuadmin",
  ADMIN_PASSWORD: "front-door-password-0123",
  BACKEND_ADMIN_USERNAME: "svc-admin",
  BACKEND_ADMIN_PASSWORD: "backend:pass#word-0123",
  SESSION_SECRET: "k3Qz9-Lp0vR7tYw2Xn5Bm8Cd1Fg4Hj6Ks-Ue0Ia3Ob7",
  TRUSTED_PROXY_HOPS: "1",
};

/** Install a production-like server env for route-handler tests. */
export function useEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [k, v] of Object.entries({ ...ENV, SITE_URL: undefined, ...overrides })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetServerEnvForTests();
}
