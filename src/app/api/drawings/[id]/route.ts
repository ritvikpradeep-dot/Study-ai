import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyTeam } from "@/lib/pusher-server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const drawing = await prisma.drawing.findUnique({
    where: { id },
    include: { document: { select: { id: true, teamId: true } } },
  });
  if (!drawing || drawing.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.drawing.delete({ where: { id } });

  if (drawing.document.teamId) {
    await notifyTeam(drawing.document.teamId, "drawing-deleted", {
      documentId: drawing.document.id,
      drawingId: id,
    });
  }

  return NextResponse.json({ ok: true });
}
