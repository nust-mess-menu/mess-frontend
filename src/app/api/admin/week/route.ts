import type { NextRequest } from "next/server";
import { adminRoute, callBackend } from "@/lib/server/admin";

/** GET /api/admin/week - the active week */
export function GET(request: NextRequest) {
  return adminRoute(request, { mutation: false }, () => callBackend("GET", "/api/admin/week/switch"));
}

/** POST /api/admin/week - switch to the other week */
export function POST(request: NextRequest) {
  return adminRoute(request, { mutation: true }, () => callBackend("POST", "/api/admin/week/switch"));
}
