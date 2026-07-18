import { prisma } from "@/lib/prisma";
import type { Prisma, ActivityAction } from "@prisma/client";
import { notifyTeam } from "@/lib/pusher-server";

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

  // Generic "something new happened" ping rather than broadcasting the full
  // entry — the feed just refetches, which keeps this future-proof for any
  // new ActivityAction without needing a matching client-side event binding.
  await notifyTeam(params.teamId, "activity-logged", {});
}
