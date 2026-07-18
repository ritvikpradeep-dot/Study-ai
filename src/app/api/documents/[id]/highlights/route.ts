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

  const highlights = await prisma.highlight.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    highlights: highlights.map((h) => ({
      id: h.id,
      page: h.page,
      textSnippet: h.textSnippet,
      startOffset: h.startOffset,
      endOffset: h.endOffset,
      color: h.color,
      authorId: h.author.id,
      authorName: h.author.name || h.author.email,
      isMine: h.author.id === session.user.id,
      createdAt: h.createdAt,
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
  const textSnippet = typeof body.textSnippet === "string" ? body.textSnippet.trim().slice(0, 2000) : "";
  const page = Number.isInteger(body.page) ? body.page : 1;
  const startOffset = Number.isInteger(body.startOffset) ? body.startOffset : 0;
  const endOffset = Number.isInteger(body.endOffset) ? body.endOffset : textSnippet.length;

  if (!textSnippet) {
    return NextResponse.json({ error: "No text selected." }, { status: 400 });
  }

  const highlight = await prisma.highlight.create({
    data: {
      documentId: id,
      authorId: session.user.id,
      page,
      textSnippet,
      startOffset,
      endOffset,
      color: colorForAuthor(session.user.id),
    },
  });

  return NextResponse.json({ highlight });
}
