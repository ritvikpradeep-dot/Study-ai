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

  const [notes, highlights] = await Promise.all([
    prisma.note.findMany({ where: { documentId: id }, select: { id: true } }),
    prisma.highlight.findMany({ where: { documentId: id }, select: { id: true } }),
  ]);
  const noteIds = notes.map((n) => n.id);
  const highlightIds = highlights.map((h) => h.id);

  const reactions = await prisma.reaction.findMany({
    where: {
      OR: [
        { targetType: "NOTE", targetId: { in: noteIds } },
        { targetType: "HIGHLIGHT", targetId: { in: highlightIds } },
      ],
    },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    reactions: reactions.map((r) => ({
      targetType: r.targetType,
      targetId: r.targetId,
      emoji: r.emoji,
      authorId: r.author.id,
      authorName: r.author.name || r.author.email,
      isMine: r.author.id === session.user.id,
    })),
  });
}
