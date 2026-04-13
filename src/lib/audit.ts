import type { NextRequest } from "next/server";
import { db, auditLogs } from "@/db";

export type AuditAction = "create" | "update" | "delete";
type AuditDbExecutor = Pick<typeof db, "insert">;

export async function logAuditEvent(input: {
  actorUserId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: unknown;
  request?: NextRequest;
  executor?: AuditDbExecutor;
}) {
  const { actorUserId, action, entityType, entityId, changes, request, executor } = input;
  const auditDb = executor ?? db;

  await auditDb.insert(auditLogs).values({
    actorUserId,
    action,
    entityType,
    entityId,
    changes: changes ?? null,
    metadata: request
      ? {
          ip:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
          method: request.method,
          path: new URL(request.url).pathname,
        }
      : null,
  });
}
