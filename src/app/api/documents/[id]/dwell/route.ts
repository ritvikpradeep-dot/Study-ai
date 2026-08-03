import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/documents";

const MAX_SECONDS_PER_BEACON = 60; // client flushes every ~10s; cap guards against a stuck/replayed beacon

// Accumulates reading time per user/document/page — written only when the
// document's room opted into struggle-data sharing (Team.shareStruggleData).
// Silently no-ops for solo documents or non-opted rooms rather than erroring,
// so the client doesn't need to know the sharing state to call this safely.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    select: { userId: true, teamId: true, team: { select: { shareStruggleData: true } } },
  });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!document.teamId || !document.team?.shareStruggleData) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  const body = await request.json().catch(() => ({}));
  const page = Number.isInteger(body.page) && body.page > 0 ? body.page : null;
  const seconds =
    typeof body.seconds === "number" && body.seconds > 0
      ? Math.min(MAX_SECONDS_PER_BEACON, Math.round(body.seconds))
      : null;
  if (!page || !seconds) return NextResponse.json({ error: "Invalid dwell data." }, { status: 400 });

  await prisma.pageDwell.upsert({
    where: { documentId_userId_page: { documentId: id, userId: session.user.id, page } },
    create: { documentId: id, userId: session.user.id, page, seconds },
    update: { seconds: { increment: seconds } },
  });

  return NextResponse.json({ ok: true, tracked: true });
}
