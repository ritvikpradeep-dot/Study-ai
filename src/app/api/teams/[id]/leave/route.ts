import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: id, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role === "OWNER") {
    return NextResponse.json(
      { error: "The team owner can't leave. Remove the team's documents and ask another member to take over, or delete members instead." },
      { status: 400 }
    );
  }

  await prisma.teamMember.delete({ where: { id: membership.id } });
  return NextResponse.json({ ok: true });
}
