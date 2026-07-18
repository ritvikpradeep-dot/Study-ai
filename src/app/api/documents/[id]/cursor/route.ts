import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/documents";
import { notifyTeam } from "@/lib/pusher-server";

// Purely ephemeral relay — no DB write, not activity-logged. Broadcasts a
// live cursor position to other room members viewing the same document.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    select: { userId: true, teamId: true },
  });
  if (!document || !document.teamId || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const page = Number.isInteger(body.page) ? body.page : 1;
  const x = typeof body.x === "number" ? Math.min(1, Math.max(0, body.x)) : null;
  const y = typeof body.y === "number" ? Math.min(1, Math.max(0, body.y)) : null;
  if (x === null || y === null) return NextResponse.json({ error: "Invalid cursor position." }, { status: 400 });

  await notifyTeam(document.teamId, "cursor-move", {
    documentId: id,
    page,
    x,
    y,
    authorId: session.user.id,
    authorName: session.user.name || session.user.email,
  });

  return NextResponse.json({ ok: true });
}
