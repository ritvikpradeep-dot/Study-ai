import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { streamText, isAiConfigured, clampDocumentText } from "@/lib/ai";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isAiConfigured()) {
    return new Response(
      "AI features aren't configured yet. Add OPENROUTER_API_KEY to .env.local and restart the server.",
      { status: 503 }
    );
  }

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }
  if (!document.textContent) {
    return new Response("This document has no extracted text yet.", { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const question = typeof body.message === "string" ? body.message.trim() : "";
  const regenerate = body.regenerate === true;

  if (regenerate) {
    const lastMessage = await prisma.chatMessage.findFirst({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
    });
    if (lastMessage?.role === "assistant") {
      await prisma.chatMessage.delete({ where: { id: lastMessage.id } });
    }
  } else {
    if (!question) {
      return new Response("Message is required.", { status: 400 });
    }
    await prisma.chatMessage.create({
      data: { documentId: id, role: "user", content: question },
    });
  }

  const history = await prisma.chatMessage.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const documentText = clampDocumentText(document.textContent);

  const systemPrompt = `You are a study assistant helping a student understand a specific document titled "${document.title}". Answer only using information from the document text provided below. If the answer isn't in the document, say so clearly instead of making things up. You can reference page-level context if the student asks, explain concepts simply, give real-world examples, generate mnemonics, and compare topics when asked.\n\nDocument text:\n${documentText}`;

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const chunks = streamText({
          system: systemPrompt,
          contents: history.map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("model" as const),
            text: m.content,
          })),
          maxTokens: 2048,
        });

        for await (const chunk of chunks) {
          if (request.signal.aborted) break;
          fullResponse += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        if (fullResponse) {
          await prisma.chatMessage.create({
            data: { documentId: id, role: "assistant", content: fullResponse },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        controller.enqueue(encoder.encode(`\n\n[Error: ${message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
