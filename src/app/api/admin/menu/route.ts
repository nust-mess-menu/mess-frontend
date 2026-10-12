import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, callBackend, jsonError, readJsonBody } from "@/lib/server/admin";

const day = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
const mealType = z.enum(["breakfast", "lunch", "dinner"]);
const weekNumber = z.union([z.literal(1), z.literal(2)]);

// Only these fields are forwarded; anything else in the body is dropped
const saveBody = z.object({
  weekNumber,
  day,
  mealType,
  dishes: z.union([z.string().max(128), z.array(z.string().max(400)).max(20)]),
});

const slotQuery = z.object({ weekNumber: z.enum(["1", "2"]), day, mealType });

/** GET /api/admin/menu[?week=1|2] */
export function GET(request: NextRequest) {
  return adminRoute(request, { mutation: false }, async () => {
    const week = request.nextUrl.searchParams.get("week");
    if (week !== null && week !== "1" && week !== "2") return jsonError(400, "week must be 1 or 2", "bad_request");
    return callBackend("GET", "/api/admin/menu", { query: week ? { week } : {} });
  });
}

/** POST /api/admin/menu { weekNumber, day, mealType, dishes } */
export function POST(request: NextRequest) {
  return adminRoute(request, { mutation: true }, async () => {
    const parsed = await readJsonBody(request, 16 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = saveBody.safeParse(parsed.body);
    if (!body.success) return jsonError(400, "Invalid menu slot", "validation_failed");
    return callBackend("POST", "/api/admin/menu", { body: body.data });
  });
}

/** DELETE /api/admin/menu?weekNumber=1&day=monday&mealType=lunch */
export function DELETE(request: NextRequest) {
  return adminRoute(request, { mutation: true }, async () => {
    const sp = request.nextUrl.searchParams;
    const query = slotQuery.safeParse({ weekNumber: sp.get("weekNumber"), day: sp.get("day"), mealType: sp.get("mealType") });
    if (!query.success) return jsonError(400, "Invalid menu slot", "validation_failed");
    return callBackend("DELETE", "/api/admin/menu", { query: query.data });
  });
}
