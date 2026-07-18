import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/documents";

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

  if (document.teamId) {
    // Room document: notes are shared — every member sees everyone's,
    // editable only by its own author (enforced by PUT below).
    const notes = await prisma.note.findMany({
      where: { documentId: id },
      orderBy: { updatedAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({
      shared: true,
      notes: notes.map((n) => ({
        authorId: n.user.id,
        authorName: n.user.name || n.user.email,
        content: n.content,
        updatedAt: n.updatedAt,
        isMine: n.user.id === session.user.id,
      })),
    });
  }

  const note = await prisma.note.findUnique({
    where: { documentId_userId: { documentId: id, userId: session.user.id } },
  });

  return NextResponse.json({
    shared: false,
    notes: [
      {
        authorId: session.user.id,
        authorName: null,
        content: note?.content ?? "",
        updatedAt: note?.updatedAt ?? null,
        isMine: true,
      },
    ],
  });
}

export async function PUT(
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
  const content = typeof body.content === "string" ? body.content : "";
  if (content.length > 50_000) {
    return NextResponse.json({ error: "Note is too long (max 50,000 characters)." }, { status: 400 });
  }

  const note = await prisma.note.upsert({
    where: { documentId_userId: { documentId: id, userId: session.user.id } },
    create: { documentId: id, userId: session.user.id, content },
    update: { content },
  });

  return NextResponse.json({ note });
}
