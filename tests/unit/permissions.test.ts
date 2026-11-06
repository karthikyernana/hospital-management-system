import { describe, expect, it } from "vitest";
import { assertCan, can, ROLE_PERMISSIONS } from "@/server/auth/permissions";

describe("RBAC permission matrix", () => {
  it("never lets front desk read or write clinical visit records", () => {
    expect(can("FRONT_DESK", "visit:read")).toBe(false);
    expect(can("FRONT_DESK", "visit:write")).toBe(false);
  });

  it("lets only clinicians write visit records", () => {
    const writers = Object.entries(ROLE_PERMISSIONS)
      .filter(([, perms]) => perms.includes("visit:write"))
      .map(([role]) => role);
    expect(writers).toEqual(["CLINICIAN"]);
  });

  it("restricts the audit log to administrators", () => {
    expect(can("ADMIN", "audit:read")).toBe(true);
    for (const role of ["FRONT_DESK", "CLINICIAN", "PATIENT"] as const) expect(can(role, "audit:read")).toBe(false);
  });

  it("does not let clinicians or patients manage the directory or billing back-office", () => {
    expect(can("CLINICIAN", "billing:write")).toBe(false);
    expect(can("CLINICIAN", "directory:write")).toBe(false);
    expect(can("PATIENT", "patient:read")).toBe(false);
  });

  it("assertCan throws a 403 AppError", () => {
    expect(() => assertCan("FRONT_DESK", "visit:read")).toThrowError(expect.objectContaining({ status: 403, code: "FORBIDDEN" }));
    expect(() => assertCan("CLINICIAN", "visit:read")).not.toThrow();
  });
});
