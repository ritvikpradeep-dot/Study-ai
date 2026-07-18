import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const note = await prisma.stickyNote.findUnique({ where: { id } });
  if (!note || note.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { x?: number; y?: number; content?: string } = {};
  if (typeof body.x === "number" && body.x >= 0 && body.x <= 1) data.x = body.x;
  if (typeof body.y === "number" && body.y >= 0 && body.y <= 1) data.y = body.y;
  if (typeof body.content === "string") data.content = body.content.slice(0, 2000);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.stickyNote.update({ where: { id }, data });
  return NextResponse.json({ stickyNote: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const note = await prisma.stickyNote.findUnique({ where: { id } });
  if (!note || note.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.stickyNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
