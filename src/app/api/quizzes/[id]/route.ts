import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument, canManageDocument } from "@/lib/documents";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      document: { select: { userId: true, teamId: true, title: true } },
      questions: { orderBy: { orderIndex: "asc" } },
      attempts: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!quiz || !(await canAccessDocument(session.user.id, quiz.document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ quiz });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { document: { select: { userId: true, teamId: true } } },
  });
  if (!quiz || !(await canAccessDocument(session.user.id, quiz.document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canManageDocument(session.user.id, quiz.document))) {
    return NextResponse.json(
      { error: "Only the document's uploader or the team owner can delete this quiz." },
      { status: 403 }
    );
  }

  await prisma.quiz.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
