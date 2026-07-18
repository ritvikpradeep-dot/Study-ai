import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateText, isAiConfigured, clampDocumentText, logAiUsage } from "@/lib/ai";
import { canAccessDocument } from "@/lib/documents";

// The persisted, canonical summary shown to every room member — distinct
// from the free-form, ephemeral output in the Summarize tab's custom
// length/style controls. Only the room host (or the owner of a solo
// document) can (re)generate it.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAiConfigured()) {
    return NextResponse.json(
      {
        error:
          "AI features aren't configured yet. Add GROQ_API_KEY to .env.local and restart the server.",
      },
      { status: 503 }
    );
  }

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!document.textContent) {
    return NextResponse.json({ error: "This document has no extracted text yet." }, { status: 400 });
  }

  if (document.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: document.teamId, userId: session.user.id } },
    });
    if (membership?.role !== "OWNER") {
      return NextResponse.json(
        { error: "Only the room's host can generate the shared summary." },
        { status: 403 }
      );
    }
  } else if (document.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const documentText = clampDocumentText(document.textContent);

  try {
    const summary = await generateText({
      system:
        "You are a study assistant. Write a clear, well-organized summary of the document using only information present in it — do not invent facts. Aim for a few short paragraphs covering the key points a reader needs.",
      user: `Document title: ${document.title}\n\nDocument text:\n${documentText}`,
      maxTokens: 3000,
      onUsage: (usage) => logAiUsage({ userId: session.user.id, documentId: id, feature: "summarize", usage }),
    });

    if (!summary) {
      return NextResponse.json({ error: "The model didn't return a summary. Try again." }, { status: 502 });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { summary, summaryGeneratedAt: new Date() },
      select: { summary: true, summaryGeneratedAt: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate summary." },
      { status: 500 }
    );
  }
}
