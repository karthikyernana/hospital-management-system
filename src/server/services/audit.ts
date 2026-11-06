/**
 * Audit trail. Every read of a sensitive record (patient chart, visit,
 * invoice) and every material change writes an append-only AuditLog row.
 * Pass the transaction client when auditing inside a transaction so the
 * audit entry commits or rolls back together with the change.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../db";
import type { SessionUser } from "../auth/session";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "ACCESS_DENIED"
  | "READ"
  | "CREATE"
  | "UPDATE"
  | "STATUS_CHANGE"
  | "PAYMENT";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  patientId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function audit(actor: Pick<SessionUser, "id" | "role"> | null, input: AuditInput, db: Db = prisma) {
  await db.auditLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorRole: actor?.role ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      patientId: input.patientId ?? null,
      metadata: input.metadata,
    },
  });
}
