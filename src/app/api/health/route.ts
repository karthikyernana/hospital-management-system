import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/** GET /api/health — liveness and database connectivity. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ data: { status: "ok", database: "up", time: new Date().toISOString() } });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Database unreachable" } }, { status: 503 });
  }
}
