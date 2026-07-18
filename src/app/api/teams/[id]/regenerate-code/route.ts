import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireHost } from "@/lib/host";
import { logActivity } from "@/lib/activity";

function generateInviteCode() {
  return randomBytes(6).toString("base64url");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gate = await requireHost(id);
  if (!gate) {
    return NextResponse.json(
      { error: "Only the room's host can change the invite code." },
      { status: 403 }
    );
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const team = await prisma.team.update({
        where: { id },
        data: { inviteCode: generateInviteCode() },
      });
      await logActivity({ teamId: id, actorId: gate.session.user.id, action: "INVITE_CODE_REGENERATED" });
      return NextResponse.json({ inviteCode: team.inviteCode });
    } catch (err) {
      const isUniqueClash =
        err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002";
      if (!isUniqueClash) throw err;
    }
  }
  return NextResponse.json({ error: "Failed to generate a new code, try again." }, { status: 500 });
}
