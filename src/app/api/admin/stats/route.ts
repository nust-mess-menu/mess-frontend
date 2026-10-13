import type { NextRequest } from "next/server";
import { adminRoute, callBackend } from "@/lib/server/admin";

/** GET /api/admin/stats[?fresh=1] - visitors, ratings and reviews per day/week/month */
export function GET(request: NextRequest) {
  return adminRoute(request, { mutation: false }, () =>
    callBackend("GET", "/api/admin/stats", {
      query: request.nextUrl.searchParams.get("fresh") === "1" ? { fresh: "1" } : {},
    })
  );
}
