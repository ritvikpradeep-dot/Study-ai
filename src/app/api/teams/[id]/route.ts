import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/host";
import { notifyTeam } from "@/lib/pusher-server";
import { deleteStoredFile } from "@/lib/storage";

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

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { joinedAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { documents: true } },
    },
  });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    team: {
      id: team.id,
      name: team.name,
      inviteCode: team.inviteCode,
      myRole: membership.role,
      documentCount: team._count.documents,
      members: team.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    },
  });
}

// Disband: permanent, irreversible delete of the room and everything in it —
// distinct from close (/close), which is a reversible archive. Deleting the
// team's documents first takes their annotations/chat down via cascade
// (Document.teamId is SetNull on team delete, so without this the room's
// documents would silently survive as the uploader's solo documents);
// members, permissions, activity log, room chat, and pomodoro sessions
// cascade off the team row itself.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await requireHost(id);
  if (!gate) {
    return NextResponse.json({ error: "Only the room's host can disband the room." }, { status: 403 });
  }

  const teamDocuments = await prisma.document.findMany({
    where: { teamId: id },
    select: { storageUrl: true },
  });

  await prisma.$transaction([
    prisma.document.deleteMany({ where: { teamId: id } }),
    prisma.team.delete({ where: { id } }),
  ]);

  // Same best-effort blob cleanup as the single-document delete route.
  for (const doc of teamDocuments) {
    if (doc.storageUrl) await deleteStoredFile(doc.storageUrl).catch(() => {});
  }

  // Fired after the delete so a failed transaction can't boot members from a
  // room that still exists. The Pusher channel is name-based, not DB-backed,
  // so it still delivers to currently-subscribed members.
  await notifyTeam(id, "room-disbanded", {});

  return NextResponse.json({ ok: true });
}
