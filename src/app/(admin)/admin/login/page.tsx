import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import AdminLogin from "@/components/admin/AdminLogin";
import { getAdminLock } from "@/lib/server/adminLock";
import { serverEnv } from "@/lib/server/env";
import { requestHost } from "@/lib/server/rateLimit";
import { openSession, sessionCookieName } from "@/lib/server/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function AdminLoginPage() {
  const env = serverEnv();
  if (requestHost(await headers(), env.trustedProxyHops) !== env.adminHost) notFound();
  if (openSession(env.sessionSecret, (await cookies()).get(sessionCookieName(env.isProduction))?.value)) {
    redirect("/admin");
  }
  // Show the 24-hour lock before anyone types a password
  const lock = await getAdminLock();
  return (
    <Suspense>
      <AdminLogin initialLockedUntil={lock?.locked ? lock.lockedUntil : null} />
    </Suspense>
  );
}
