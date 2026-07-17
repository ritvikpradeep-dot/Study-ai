import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileSize: true,
      pageCount: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
      _count: { select: { quizzes: true, messages: true } },
    },
  });

  return NextResponse.json({ documents });
}
