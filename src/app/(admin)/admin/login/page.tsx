import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import AdminLogin from "@/components/admin/AdminLogin";
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
  return (
    <Suspense>
      <AdminLogin />
    </Suspense>
  );
}
