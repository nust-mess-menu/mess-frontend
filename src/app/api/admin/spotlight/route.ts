import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, callBackend, jsonError, readJsonBody } from "@/lib/server/admin";

const id = z.string().regex(/^spot_[A-Za-z0-9_]{1,100}$/);

// Only these fields are forwarded; the backend re-validates and sanitizes them
const saveBody = z.object({
  id: id.optional(),
  status: z.enum(["draft", "active", "paused"]),
  advertiser: z.string().max(120),
  headline: z.string().max(160),
  body: z.string().max(320),
  ctaLabel: z.string().max(60),
  ctaUrl: z.string().max(500),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  // A bundled path, or an uploaded logo (a data URI of at most 60k characters)
  logo: z.string().max(60_000).nullable(),
  slots: z.array(z.enum(["today", "week"])).min(1).max(2),
  startsAt: z.string().max(40),
  endsAt: z.string().max(40).nullable(),
  weight: z.number().int().min(1).max(10),
  snoozeDays: z.number().int().min(1).max(90),
});

/** GET /api/admin/spotlight - all campaigns with click history */
export function GET(request: NextRequest) {
  return adminRoute(request, { mutation: false }, () => callBackend("GET", "/api/admin/spotlight"));
}

/** POST /api/admin/spotlight { id?, ...campaign } - create or update */
export function POST(request: NextRequest) {
  return adminRoute(request, { mutation: true }, async () => {
    const parsed = await readJsonBody(request, 80 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = saveBody.safeParse(parsed.body);
    if (!body.success) return jsonError(400, "Invalid campaign", "validation_failed");
    return callBackend("POST", "/api/admin/spotlight", { body: body.data });
  });
}

/** DELETE /api/admin/spotlight?id=spot_... */
export function DELETE(request: NextRequest) {
  return adminRoute(request, { mutation: true }, async () => {
    const query = id.safeParse(request.nextUrl.searchParams.get("id"));
    if (!query.success) return jsonError(400, "Invalid campaign", "validation_failed");
    return callBackend("DELETE", "/api/admin/spotlight", { query: { id: query.data } });
  });
}
