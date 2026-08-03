import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";
import { canAccessDocument, canManageDocument } from "@/lib/documents";
import { notifyTeam } from "@/lib/pusher-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ document });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canManageDocument(session.user.id, document))) {
    return NextResponse.json(
      { error: "Only the uploader or the team owner can delete this document." },
      { status: 403 }
    );
  }

  await prisma.document.delete({ where: { id } });
  if (document.storageUrl) {
    await deleteStoredFile(document.storageUrl).catch(() => {});
  }

  // A room built around this single document (the common case — host-only
  // upload) shouldn't survive as an empty shell once its only document is
  // gone. If other documents remain in the room, leave it alone.
  let roomDisbanded = false;
  if (document.teamId) {
    const remaining = await prisma.document.count({ where: { teamId: document.teamId } });
    if (remaining === 0) {
      await notifyTeam(document.teamId, "room-disbanded", {});
      await prisma.team.delete({ where: { id: document.teamId } }).catch(() => {});
      roomDisbanded = true;
    }
  }

  return NextResponse.json({ ok: true, roomDisbanded });
}
