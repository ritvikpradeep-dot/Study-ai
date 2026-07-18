import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_TEAM_MEMBERS } from "@/lib/teams";
import { logActivity } from "@/lib/activity";
import { notifyTeam } from "@/lib/pusher-server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  if (!inviteCode) return NextResponse.json({ error: "Invite code is required." }, { status: 400 });

  const team = await prisma.team.findUnique({
    where: { inviteCode },
    include: { _count: { select: { members: true } } },
  });
  if (!team) return NextResponse.json({ error: "Invalid invite code." }, { status: 404 });
  if (team.closedAt) return NextResponse.json({ error: "This room is closed." }, { status: 400 });

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: session.user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "You're already a member of this team." }, { status: 400 });
  }

  if (team._count.members >= MAX_TEAM_MEMBERS) {
    return NextResponse.json(
      { error: `This room is full (max ${MAX_TEAM_MEMBERS} members).` },
      { status: 409 }
    );
  }

  // Re-check the cap inside a transaction to close the race where two joins
  // land between the count check above and the insert.
  try {
    await prisma.$transaction(async (tx) => {
      const count = await tx.teamMember.count({ where: { teamId: team.id } });
      if (count >= MAX_TEAM_MEMBERS) {
        throw new Error("ROOM_FULL");
      }
      await tx.teamMember.create({
        data: { teamId: team.id, userId: session.user.id, role: "MEMBER" },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ROOM_FULL") {
      return NextResponse.json(
        { error: `This room is full (max ${MAX_TEAM_MEMBERS} members).` },
        { status: 409 }
      );
    }
    throw err;
  }

  await logActivity({ teamId: team.id, actorId: session.user.id, action: "MEMBER_JOINED" });
  await notifyTeam(team.id, "member-joined", {
    userId: session.user.id,
    name: session.user.name || session.user.email,
  });

  return NextResponse.json({ team: { id: team.id, name: team.name } });
}
