import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, callBackend, jsonError, readJsonBody } from "@/lib/server/admin";

const mealBody = z.object({
  items: z.array(z.string().max(400)).min(1).max(20),
  name: z.string().max(200).optional(),
  category: z.enum(["breakfast", "lunch", "dinner"]).optional(),
  mealId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
});

/** GET /api/admin/meals - the meal library */
export function GET(request: NextRequest) {
  return adminRoute(request, { mutation: false }, () => callBackend("GET", "/api/meals/list"));
}

/** POST /api/admin/meals { items, name?, category?, mealId? } - create or update */
export function POST(request: NextRequest) {
  return adminRoute(request, { mutation: true }, async () => {
    const parsed = await readJsonBody(request, 16 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = mealBody.safeParse(parsed.body);
    if (!body.success) return jsonError(400, "Invalid meal", "validation_failed");
    return callBackend("POST", "/api/meals/create", { body: body.data });
  });
}
