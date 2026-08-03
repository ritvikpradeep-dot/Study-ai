import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyTeam } from "@/lib/pusher-server";

// Hard delete, not a "[message deleted]" placeholder — there's no
// audit/moderation requirement on room chat elsewhere in the app (unlike,
// say, the admin content viewer's read access to other data), so there's no
// reason to keep a trace of the removed text.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const message = await prisma.roomMessage.findUnique({ where: { id } });
  if (!message || message.authorId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.roomMessage.delete({ where: { id } });

  // Room chat is otherwise polling-based, but a poll only fetches messages
  // *after* the last one it's seen — it has no mechanism to retract a
  // message a client already rendered. A push event is the only way to make
  // a delete actually disappear for everyone in real time.
  await notifyTeam(message.teamId, "room-message-deleted", { messageId: id });

  return NextResponse.json({ ok: true });
}
