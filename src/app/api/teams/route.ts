import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_TEAM_MEMBERS } from "@/lib/teams";

function generateInviteCode() {
  return randomBytes(6).toString("base64url"); // ~8 chars, URL-safe
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    include: {
      team: {
        include: {
          _count: { select: { members: true, documents: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const teams = memberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    inviteCode: m.team.inviteCode,
    myRole: m.role,
    memberCount: m.team._count.members,
    maxMembers: MAX_TEAM_MEMBERS,
    documentCount: m.team._count.documents,
  }));

  return NextResponse.json({ teams });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Team name is required." }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: "Team name is too long." }, { status: 400 });

  // inviteCode collisions are astronomically unlikely at this scale, but
  // retry once just in case rather than letting the unique constraint 500.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const team = await prisma.team.create({
        data: {
          name,
          ownerId: session.user.id,
          inviteCode: generateInviteCode(),
          members: {
            create: { userId: session.user.id, role: "OWNER" },
          },
        },
      });
      return NextResponse.json({ team });
    } catch (err) {
      const isUniqueClash =
        err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUniqueClash) throw err;
    }
  }
  return NextResponse.json({ error: "Failed to create team, try again." }, { status: 500 });
}
