import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function describe(action: string, actorName: string, metadata: unknown): string {
  const meta = (metadata as Record<string, unknown>) ?? {};
  switch (action) {
    case "DOCUMENT_UPLOADED":
      return `${actorName} uploaded ${typeof meta.title === "string" ? `"${meta.title}"` : "a document"}`;
    case "NOTE_ADDED":
      return `${actorName} added a note`;
    case "HIGHLIGHT_ADDED":
      return `${actorName} added a highlight${typeof meta.page === "number" ? ` on page ${meta.page}` : ""}`;
    case "MEMBER_JOINED":
      return `${actorName} joined the room`;
    case "POMODORO_STARTED":
      return `${actorName} started a Pomodoro session`;
    default:
      return `${actorName} did something`;
  }
}

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
    take: 50,
    include: { actor: { select: { name: true, email: true } } },
  });

  return NextResponse.json({
    entries: entries.map((e) => {
      const actorName = e.actor.name || e.actor.email;
      return {
        id: e.id,
        message: describe(e.action, actorName, e.metadata),
        createdAt: e.createdAt,
      };
    }),
  });
}
