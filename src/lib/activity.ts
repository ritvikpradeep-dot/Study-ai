import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type ActivityAction = "DOCUMENT_UPLOADED" | "NOTE_ADDED" | "HIGHLIGHT_ADDED" | "MEMBER_JOINED" | "POMODORO_STARTED";

export async function logActivity(params: {
  teamId: string;
  actorId: string;
  action: ActivityAction;
  metadata?: Record<string, unknown>;
}) {
  await prisma.activityLogEntry
    .create({
      data: {
        teamId: params.teamId,
        actorId: params.actorId,
        action: params.action,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    })
    // Activity logging is a side channel — it must never break the action
    // it's recording (upload, join, etc).
    .catch(() => {});
}
