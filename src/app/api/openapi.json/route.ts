import { NextResponse } from "next/server";
import { openApiSpec } from "@/server/openapi/spec";

/** GET /api/openapi.json — machine-readable API description (public). */
export function GET() {
  return NextResponse.json(openApiSpec);
}
