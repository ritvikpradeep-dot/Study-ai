import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/documents";

const VALID_TARGET_TYPES = ["NOTE", "HIGHLIGHT"];
// Kept small and fixed rather than free-form input, matching the "lightweight
// emoji reactions" spec — not a general emoji picker.
const VALID_EMOJI = ["👍", "💡", "❓", "✅"];

async function resolveDocumentId(targetType: string, targetId: string): Promise<string | null> {
  if (targetType === "NOTE") {
    const note = await prisma.note.findUnique({ where: { id: targetId }, select: { documentId: true } });
    return note?.documentId ?? null;
  }
  const highlight = await prisma.highlight.findUnique({
    where: { id: targetId },
    select: { documentId: true },
  });
  return highlight?.documentId ?? null;
}

// Toggle: reacting again with the same emoji removes it.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const targetType = typeof body.targetType === "string" && VALID_TARGET_TYPES.includes(body.targetType)
    ? body.targetType
    : null;
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const emoji = typeof body.emoji === "string" && VALID_EMOJI.includes(body.emoji) ? body.emoji : null;

  if (!targetType || !targetId || !emoji) {
    return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
  }

  const documentId = await resolveDocumentId(targetType, targetId);
  if (!documentId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.reaction.findUnique({
    where: {
      targetType_targetId_authorId_emoji: {
        targetType,
        targetId,
        authorId: session.user.id,
        emoji,
      },
    },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    return NextResponse.json({ reacted: false });
  }

  await prisma.reaction.create({
    data: { targetType, targetId, authorId: session.user.id, emoji },
  });
  return NextResponse.json({ reacted: true });
}
