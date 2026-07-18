import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/host";
import { logActivity } from "@/lib/activity";
import { notifyTeam } from "@/lib/pusher-server";

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

  const permissions = await prisma.editPermission.findMany({ where: { teamId: id } });
  return NextResponse.json({
    permissions: permissions.map((p) => ({ userId: p.userId, canEdit: p.canEdit })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await requireHost(id);
  if (!gate) {
    return NextResponse.json(
      { error: "Only the room's host can change edit access." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const canEdit = body.canEdit === true;
  if (!userId) return NextResponse.json({ error: "Member is required." }, { status: 400 });
  if (userId === gate.session.user.id) {
    return NextResponse.json({ error: "The host always has edit access." }, { status: 400 });
  }

  const targetMembership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: id, userId } },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "That user isn't a member of this room." }, { status: 404 });
  }

  const permission = await prisma.editPermission.upsert({
    where: { teamId_userId: { teamId: id, userId } },
    create: { teamId: id, userId, canEdit, grantedByHostAt: new Date() },
    update: { canEdit, grantedByHostAt: new Date() },
  });

  await logActivity({
    teamId: id,
    actorId: gate.session.user.id,
    action: canEdit ? "EDIT_ACCESS_GRANTED" : "EDIT_ACCESS_REVOKED",
    metadata: {
      targetUserId: userId,
      targetName: targetMembership.user.name || targetMembership.user.email,
    },
  });
  await notifyTeam(id, "edit-permission-changed", { userId, canEdit });

  return NextResponse.json({ permission: { userId: permission.userId, canEdit: permission.canEdit } });
}
