/** Read side of the audit trail (administrators only). */
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { assertCan } from "../auth/permissions";
import type { SessionUser } from "../auth/session";
import type { AuditListQuery } from "@/lib/validation/reports";
import type { Paginated } from "@/lib/validation/common";
import { addDays, localMidnightUtc } from "@/lib/time";

const include = { actor: { select: { id: true, name: true, email: true } } } satisfies Prisma.AuditLogInclude;
export type AuditEntry = Prisma.AuditLogGetPayload<{ include: typeof include }>;

export async function listAuditLogs(actor: SessionUser, q: AuditListQuery): Promise<Paginated<AuditEntry>> {
  assertCan(actor.role, "audit:read");
  const where: Prisma.AuditLogWhereInput = {
    action: q.action,
    entityType: q.entityType,
    actorId: q.actorId,
    patientId: q.patientId,
    createdAt: {
      ...(q.from ? { gte: localMidnightUtc(q.from) } : {}),
      ...(q.to ? { lt: localMidnightUtc(addDays(q.to, 1)) } : {}),
    },
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function auditFacets(actor: SessionUser) {
  assertCan(actor.role, "audit:read");
  const [actions, entities] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({ by: ["entityType"], _count: true, orderBy: { entityType: "asc" } }),
  ]);
  return { actions: actions.map((a) => a.action), entityTypes: entities.map((e) => e.entityType) };
}
