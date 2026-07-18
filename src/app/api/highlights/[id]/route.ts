import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const highlight = await prisma.highlight.findUnique({ where: { id } });
  if (!highlight || highlight.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Reaction has no DB relation to Highlight (polymorphic target), so its
  // rows for this highlight aren't cascade-deleted automatically.
  await prisma.reaction.deleteMany({ where: { targetType: "HIGHLIGHT", targetId: id } });
  await prisma.highlight.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
