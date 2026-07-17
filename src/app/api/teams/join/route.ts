import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  if (!inviteCode) return NextResponse.json({ error: "Invite code is required." }, { status: 400 });

  const team = await prisma.team.findUnique({ where: { inviteCode } });
  if (!team) return NextResponse.json({ error: "Invalid invite code." }, { status: 404 });

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: session.user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "You're already a member of this team." }, { status: 400 });
  }

  await prisma.teamMember.create({
    data: { teamId: team.id, userId: session.user.id, role: "MEMBER" },
  });

  return NextResponse.json({ team: { id: team.id, name: team.name } });
}
