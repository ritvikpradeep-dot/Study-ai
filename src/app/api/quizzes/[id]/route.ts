import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
      document: { select: { userId: true, title: true } },
      questions: { orderBy: { orderIndex: "asc" } },
      attempts: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!quiz || quiz.document.userId !== session.user.id) {
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
    include: { document: { select: { userId: true } } },
  });
  if (!quiz || quiz.document.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.quiz.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
