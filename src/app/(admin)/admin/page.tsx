import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { serverEnv } from "@/lib/server/env";
import { requestHost } from "@/lib/server/rateLimit";
import { openSession, sessionCookieName } from "@/lib/server/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminPage() {
  // The real check (the proxy redirect is only a convenience)
  const env = serverEnv();
  if (requestHost(await headers(), env.trustedProxyHops) !== env.adminHost) notFound();
  const session = openSession(env.sessionSecret, (await cookies()).get(sessionCookieName(env.isProduction))?.value);
  if (!session) redirect("/admin/login");

  return <AdminDashboard sessionExpiresAt={new Date(session.exp * 1000).toISOString()} />;
}
