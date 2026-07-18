import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/documents";
import { colorForAuthor } from "@/lib/annotation-colors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const notes = await prisma.stickyNote.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    stickyNotes: notes.map((n) => ({
      id: n.id,
      page: n.page,
      x: n.x,
      y: n.y,
      content: n.content,
      color: n.color,
      authorId: n.author.id,
      authorName: n.author.name || n.author.email,
      isMine: n.author.id === session.user.id,
      updatedAt: n.updatedAt,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const page = Number.isInteger(body.page) ? body.page : 1;
  const x = typeof body.x === "number" && body.x >= 0 && body.x <= 1 ? body.x : null;
  const y = typeof body.y === "number" && body.y >= 0 && body.y <= 1 ? body.y : null;
  const content = typeof body.content === "string" ? body.content.slice(0, 2000) : "";

  if (x === null || y === null) {
    return NextResponse.json({ error: "Invalid sticky note position." }, { status: 400 });
  }

  const note = await prisma.stickyNote.create({
    data: {
      documentId: id,
      authorId: session.user.id,
      page,
      x,
      y,
      content,
      color: colorForAuthor(session.user.id),
    },
  });

  return NextResponse.json({ stickyNote: note });
}
