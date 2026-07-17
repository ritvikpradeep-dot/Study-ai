import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { streamText, isAiConfigured, clampDocumentText, logAiUsage } from "@/lib/ai";
import { canAccessDocument } from "@/lib/documents";

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  "one-sentence": "Summarize it in exactly one sentence.",
  short: "Write a short summary (roughly 3-5 sentences or bullet points).",
  medium: "Write a medium-length summary (roughly 1-2 paragraphs).",
  detailed: "Write a detailed summary covering all major points.",
  comprehensive: "Write a comprehensive, thorough summary that captures nearly everything important.",
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  bullet: "Format the summary as concise bullet points.",
  paragraph: "Format the summary as flowing prose paragraphs.",
  outline: "Format the summary as a nested outline (headings and sub-points).",
  "study-notes": "Format the summary as study notes, with clear headings and key facts highlighted.",
  timeline: "Format the summary as a chronological timeline of events/concepts, if applicable.",
  "chapter-wise": "Format the summary broken down chapter by chapter or section by section.",
  "topic-wise": "Format the summary broken down by topic/theme rather than by document order.",
};

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
      "AI features aren't configured yet. Add GROQ_API_KEY to .env.local and restart the server.",
      { status: 503 }
    );
  }

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return new Response("Not found", { status: 404 });
  }
  if (!document.textContent) {
    return new Response("This document has no extracted text yet.", { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const length = typeof body.length === "string" ? body.length : "medium";
  const style = typeof body.style === "string" ? body.style : "paragraph";
  const customPercent = typeof body.customPercent === "number" ? body.customPercent : null;
  const options: string[] = Array.isArray(body.options) ? body.options : [];

  const lengthInstruction =
    customPercent != null
      ? `Summarize it to roughly ${Math.max(10, Math.min(100, customPercent))}% of its original length.`
      : LENGTH_INSTRUCTIONS[length] ?? LENGTH_INSTRUCTIONS.medium;
  const styleInstruction = STYLE_INSTRUCTIONS[style] ?? STYLE_INSTRUCTIONS.paragraph;

  const extraInstructions: string[] = [];
  if (options.includes("definitions")) extraInstructions.push("Include definitions of key terms.");
  if (options.includes("examples")) extraInstructions.push("Include illustrative examples.");
  if (options.includes("formulas")) extraInstructions.push("Highlight any formulas clearly.");
  if (options.includes("dates")) extraInstructions.push("Highlight important dates.");
  if (options.includes("keyTerms")) extraInstructions.push("Highlight key terms in **bold**.");
  if (options.includes("explainSimply"))
    extraInstructions.push("Explain difficult concepts in simple, plain language.");

  const systemPrompt = `You are a study assistant. Summarize the user's document only using information present in it. Do not invent facts. ${lengthInstruction} ${styleInstruction} ${extraInstructions.join(" ")}`;

  const documentText = clampDocumentText(document.textContent);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const chunks = streamText({
          system: systemPrompt,
          contents: [
            {
              role: "user",
              text: `Document title: ${document.title}\n\nDocument text:\n${documentText}`,
            },
          ],
          maxTokens: 4096,
        });

        let usage;
        while (true) {
          const step = await chunks.next();
          if (step.done) {
            usage = step.value;
            break;
          }
          controller.enqueue(encoder.encode(step.value));
        }
        await logAiUsage({ userId: session.user.id, documentId: id, feature: "summarize", usage });
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\n\n[Error generating summary: ${err instanceof Error ? err.message : "unknown error"}]`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
