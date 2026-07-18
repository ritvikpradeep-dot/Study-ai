import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/host";
import { logActivity } from "@/lib/activity";
import { notifyTeam } from "@/lib/pusher-server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await requireHost(id);
  if (!gate) return NextResponse.json({ error: "Only the room's host can remove members." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "Member is required." }, { status: 400 });
  if (userId === gate.session.user.id) {
    return NextResponse.json({ error: "You can't kick yourself." }, { status: 400 });
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: id, userId } },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!membership) return NextResponse.json({ error: "That user isn't a member of this room." }, { status: 404 });

  await prisma.$transaction([
    prisma.teamMember.delete({ where: { id: membership.id } }),
    prisma.editPermission.deleteMany({ where: { teamId: id, userId } }),
  ]);

  await logActivity({
    teamId: id,
    actorId: gate.session.user.id,
    action: "MEMBER_KICKED",
    metadata: { targetUserId: userId, targetName: membership.user.name || membership.user.email },
  });

  // The kicked member's TeamMember row is already gone, so every subsequent
  // server-side access/edit check for this room fails immediately regardless
  // of this broadcast. This event just gets their still-open tab to notice
  // and leave right away instead of only finding out on their next request —
  // Pusher's client channels don't expose a way to sever a specific
  // connection outright (that requires its separate user-authentication API,
  // not the channel-auth model used here), so this is the practical
  // equivalent: instant on the wire, backed by a real server-side revoke.
  await notifyTeam(id, "member-kicked", { kickedUserId: userId });

  return NextResponse.json({ ok: true, kickedUserId: userId });
}
