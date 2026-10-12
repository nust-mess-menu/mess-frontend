import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminRoute, callBackend, jsonError, readJsonBody } from "@/lib/server/admin";

// Structural check only: keys are passed through so the backend can report
// unknown days or meal types per slot instead of rejecting the whole batch
const slotValue = z.union([z.null(), z.string().max(128), z.array(z.string().max(400)).max(20)]);
const dayBlock = z.record(z.string().max(32), slotValue).refine((o) => Object.keys(o).length <= 10);
const weekBlock = z.record(z.string().max(32), z.union([z.null(), dayBlock])).refine((o) => Object.keys(o).length <= 10);
const bulkBody = z
  .object({ week1: weekBlock.nullish(), week2: weekBlock.nullish() })
  .refine((b) => b.week1 || b.week2, { message: "Include week1 and/or week2" });

/** GET /api/admin/menu/bulk - both weeks as meal IDs */
export function GET(request: NextRequest) {
  return adminRoute(request, { mutation: false }, () => callBackend("GET", "/api/admin/menu/bulk"));
}

/** POST /api/admin/menu/bulk { week1?, week2? } */
export function POST(request: NextRequest) {
  return adminRoute(request, { mutation: true }, async () => {
    const parsed = await readJsonBody(request, 100 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = bulkBody.safeParse(parsed.body);
    if (!body.success) {
      return jsonError(400, "Body must be { week1?: {day: {meal: id | dishes | null}}, week2?: ... }", "validation_failed");
    }
    const { week1, week2 } = body.data;
    return callBackend("POST", "/api/admin/menu/bulk", {
      body: { ...(week1 ? { week1 } : {}), ...(week2 ? { week2 } : {}) },
    });
  });
}
