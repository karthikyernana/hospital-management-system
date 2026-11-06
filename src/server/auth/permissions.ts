/**
 * Role-based access control matrix — the single place where "who may do what"
 * is defined. Every service calls `assertCan` before touching data, so access
 * control never depends on the UI hiding a button.
 *
 * Record-level rules (a clinician only edits their own visits, a patient only
 * sees their own data) are enforced inside the services on top of this matrix.
 */
import type { Role } from "@prisma/client";
import { forbidden } from "../http/errors";

export const PERMISSIONS = [
  "patient:read", // demographics
  "patient:write",
  "directory:read", // doctors, departments, staff, schedules
  "directory:write",
  "appointment:read",
  "appointment:write", // book / reschedule / cancel / check-in
  "visit:read", // encounters, clinical notes, prescriptions, diagnostics
  "visit:write",
  "billing:read",
  "billing:write", // create/issue/void invoices, take payments
  "report:read",
  "audit:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "patient:read", "patient:write", "directory:read", "directory:write",
    "appointment:read", "appointment:write", "visit:read",
    "billing:read", "billing:write", "report:read", "audit:read",
  ],
  // Front desk handles registration, scheduling and billing but never sees clinical content.
  FRONT_DESK: [
    "patient:read", "patient:write", "directory:read",
    "appointment:read", "appointment:write", "billing:read", "billing:write", "report:read",
  ],
  // Clinicians read demographics and own the clinical record; they cannot bill.
  CLINICIAN: ["patient:read", "directory:read", "appointment:read", "appointment:write", "visit:read", "visit:write"],
  // Patients get a self-service portal; services restrict every query to their own records.
  PATIENT: ["directory:read", "appointment:read", "appointment:write", "billing:read", "billing:write", "visit:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw forbidden(`Role ${role} is not allowed to ${permission.replace(":", " ")}`);
}
