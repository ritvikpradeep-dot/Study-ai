import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { describeActivity } from "@/lib/activity-messages";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: id, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await prisma.activityLogEntry.findMany({
    where: { teamId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, email: true } } },
  });

  return NextResponse.json({
    entries: entries.map((e) => {
      const actorName = e.actor.name || e.actor.email;
      return {
        id: e.id,
        action: e.action,
        actorId: e.actorId,
        actorName,
        message: describeActivity(e.action, actorName, e.metadata as Record<string, unknown> | null),
        createdAt: e.createdAt,
      };
    }),
  });
}
