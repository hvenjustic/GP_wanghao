import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type AuditLogInput = {
  operatorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: Prisma.InputJsonValue | null;
};

export async function createAuditLog(input: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      operatorId: input.operatorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      detail: input.detail ?? undefined
    }
  });
}
