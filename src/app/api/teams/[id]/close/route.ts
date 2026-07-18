import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/host";
import { logActivity } from "@/lib/activity";

// Closing a room is a reversible archive, not a delete: it blocks new
// uploads/joins/edits but keeps existing documents, notes, and history
// visible to members.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await requireHost(id);
  if (!gate) return NextResponse.json({ error: "Only the room's host can close the room." }, { status: 403 });

  await prisma.team.update({ where: { id }, data: { closedAt: new Date() } });
  await logActivity({ teamId: id, actorId: gate.session.user.id, action: "ROOM_CLOSED" });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await requireHost(id);
  if (!gate) return NextResponse.json({ error: "Only the room's host can reopen the room." }, { status: 403 });

  await prisma.team.update({ where: { id }, data: { closedAt: null } });
  return NextResponse.json({ ok: true });
}
