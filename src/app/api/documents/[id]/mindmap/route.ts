import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateJson, isAiConfigured, clampDocumentText, logAiUsage } from "@/lib/ai";
import { canAccessDocument } from "@/lib/documents";
import type { MindMapNode, MindMapResult } from "@/lib/mindmap-types";

function sanitizeNode(node: unknown, depth: number): MindMapNode | null {
  if (!node || typeof node !== "object") return null;
  const label = (node as { label?: unknown }).label;
  if (typeof label !== "string" || !label.trim()) return null;

  const result: MindMapNode = { label: label.trim().slice(0, 120) };
  if (depth < 2) {
    const rawChildren = (node as { children?: unknown }).children;
    if (Array.isArray(rawChildren)) {
      const children = rawChildren
        .map((c) => sanitizeNode(c, depth + 1))
        .filter((c): c is MindMapNode => c !== null)
        .slice(0, 6);
      if (children.length) result.children = children;
    }
  }
  return result;
}

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

  const documentText = clampDocumentText(document.textContent, 60_000);

  const system = `You are a study assistant turning a document into a mind map. Produce a short central topic and up to 6 main branches, each with up to 4 sub-points. Keep every label under 12 words — these render as diagram nodes, not sentences. Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:\n{"topic": string, "children": [{"label": string, "children": [{"label": string}]}]}`;
  const user = `Document title: ${document.title}\n\nDocument text:\n${documentText}`;

  try {
    const raw = await generateJson<{ topic?: unknown; children?: unknown }>({
      system,
      user,
      maxTokens: 2000,
      onUsage: (usage) => logAiUsage({ userId: session.user.id, documentId: id, feature: "mindmap", usage }),
    });

    const topic = typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim().slice(0, 120) : document.title;
    const children = Array.isArray(raw.children)
      ? raw.children
          .map((c) => sanitizeNode(c, 1))
          .filter((c): c is MindMapNode => c !== null)
          .slice(0, 6)
      : [];

    if (children.length === 0) {
      return NextResponse.json({ error: "The model didn't return a usable mind map. Try again." }, { status: 502 });
    }

    const result: MindMapResult = { topic, children };
    return NextResponse.json({ mindmap: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate mind map." },
      { status: 500 }
    );
  }
}
