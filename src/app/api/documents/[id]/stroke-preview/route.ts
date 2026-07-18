import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument, canEditDocument } from "@/lib/documents";
import { notifyTeam } from "@/lib/pusher-server";

// Purely ephemeral relay for an in-progress (not yet committed) stroke — no
// DB write, not activity-logged. The final stroke is persisted separately
// via POST /api/documents/[id]/drawings once the pointer lifts.
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
  if (!(await canEditDocument(session.user.id, document))) {
    return NextResponse.json({ error: "View-only access." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const page = Number.isInteger(body.page) ? body.page : 1;
  const points = Array.isArray(body.pathData) ? body.pathData.slice(0, 500) : null;
  if (!points || points.length < 1) {
    return NextResponse.json({ error: "Invalid stroke data." }, { status: 400 });
  }

  await notifyTeam(document.teamId, "stroke-preview", {
    documentId: id,
    page,
    pathData: points,
    tool: body.tool,
    penType: body.penType,
    color: body.color,
    strokeWidth: body.strokeWidth,
    authorId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
