import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openApiSpec } from "@/server/openapi/spec";

/** Every route handler under src/app/api must be documented in the OpenAPI spec. */
function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

describe("OpenAPI spec", () => {
  it("documents every API route", () => {
    const root = path.resolve(__dirname, "../../src/app");
    const documented = Object.keys(openApiSpec.paths);
    const missing = routeFiles(path.join(root, "api"))
      .map((f) => "/" + path.relative(root, path.dirname(f)).split(path.sep).join("/").replace(/\[(\w+)\]/g, "{$1}"))
      .filter((p) => p !== "/api/openapi.json" && !documented.includes(p));
    expect(missing).toEqual([]);
  });
});
