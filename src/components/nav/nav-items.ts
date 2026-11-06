import type { Role } from "@prisma/client";
import { can, type Permission } from "@/server/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  permission?: Permission;
  roles?: Role[];
}

/** Navigation is filtered by role for convenience; the server re-checks every request. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["ADMIN", "FRONT_DESK", "CLINICIAN"] },
  { href: "/portal", label: "My health", roles: ["PATIENT"] },
  { href: "/patients", label: "Patients", permission: "patient:read" },
  { href: "/appointments", label: "Appointments", roles: ["ADMIN", "FRONT_DESK", "CLINICIAN"] },
  { href: "/appointments/new", label: "Book appointment", permission: "appointment:write" },
  { href: "/visits", label: "Visits", roles: ["ADMIN", "CLINICIAN"] },
  { href: "/billing", label: "Billing", roles: ["ADMIN", "FRONT_DESK"] },
  { href: "/directory", label: "Directory", permission: "directory:read" },
  { href: "/reports", label: "Reports", permission: "report:read" },
  { href: "/audit", label: "Audit log", permission: "audit:read" },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => (i.roles ? i.roles.includes(role) : true) && (i.permission ? can(role, i.permission) : true));
}
