import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_TEAM_MEMBERS } from "@/lib/teams";

// Public room directory — any logged-in user can browse all rooms (name,
// host, member count) without seeing the invite code, then join by entering
// it separately via POST /api/teams/join.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { name: true, email: true } },
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({
    rooms: teams.map((t) => ({
      id: t.id,
      name: t.name,
      hostName: t.owner.name || t.owner.email,
      memberCount: t._count.members,
      maxMembers: MAX_TEAM_MEMBERS,
      isFull: t._count.members >= MAX_TEAM_MEMBERS,
      createdAt: t.createdAt,
    })),
  });
}
