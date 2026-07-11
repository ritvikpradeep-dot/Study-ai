import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateJson, generateText, isAiConfigured, clampDocumentText } from "@/lib/ai";

type GeneratedQuestion = {
  type: "mcq" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  mixed: "a mix of easy, medium and hard",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quizzes = await prisma.quiz.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true } },
      attempts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({ quizzes });
}

async function summarizeForQuiz(documentText: string): Promise<string> {
  const text = await generateText({
    system:
      "Summarize the document in 1-2 paragraphs, capturing the key facts, concepts, and terminology a student would be tested on.",
    user: documentText,
    maxTokens: 3000,
  });
  return text || documentText;
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
          "AI features aren't configured yet. Add OPENROUTER_API_KEY to .env.local and restart the server.",
      },
      { status: 503 }
    );
  }

  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!document.textContent) {
    return NextResponse.json({ error: "This document has no extracted text yet." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const source: "document" | "summary" | "custom" =
    body.source === "summary" || body.source === "custom" ? body.source : "document";
  const questionCount = Math.max(1, Math.min(50, Number(body.questionCount) || 10));
  const difficulty: string = DIFFICULTY_LABEL[body.difficulty] ? body.difficulty : "mixed";
  const types: string[] = Array.isArray(body.types) && body.types.length ? body.types : ["mcq"];
  const customQuestionsText: string =
    typeof body.customQuestionsText === "string" ? body.customQuestionsText.trim() : "";

  if (source === "custom" && !customQuestionsText) {
    return NextResponse.json(
      { error: "Paste the question paper text to generate a quiz from custom questions." },
      { status: 400 }
    );
  }

  const documentText = clampDocumentText(document.textContent);

  try {
    let sourceMaterial = documentText;
    if (source === "summary") {
      sourceMaterial = await summarizeForQuiz(documentText);
    }

    const typeList = types.join(" and ");
    let system: string;
    let user: string;

    if (source === "custom") {
      system = `You are a study assistant. The user has pasted an existing question paper. Extract each distinct question from it verbatim (keep the original wording), and for each one produce the correct answer and a short explanation using the reference document provided. If a question is multiple choice but options weren't included in the pasted text, invent 4 plausible options (one correct). Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:\n{"questions": [{"type": "mcq" | "short_answer", "question": string, "options": string[] (only for mcq, exactly 4 items), "correctAnswer": string, "explanation": string}]}`;
      user = `Reference document (for answering the questions):\n${sourceMaterial}\n\nPasted question paper:\n${customQuestionsText}`;
    } else {
      system = `You are a study assistant creating a practice quiz strictly from the material below. Generate exactly ${questionCount} questions at ${DIFFICULTY_LABEL[difficulty]} difficulty. Use only these question types: ${typeList}. For "mcq" questions include exactly 4 plausible options with one correct answer. For "short_answer" questions give a concise canonical correct answer. Always include a short explanation. Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:\n{"questions": [{"type": "mcq" | "short_answer", "question": string, "options": string[] (only for mcq, exactly 4 items), "correctAnswer": string, "explanation": string}]}`;
      user = `Material:\n${sourceMaterial}`;
    }

    const result = await generateJson<{ questions: GeneratedQuestion[] }>({
      system,
      user,
      maxTokens: Math.max(4000, Math.min(10000, 500 * questionCount + 2000)),
    });

    const questions = (result.questions || []).filter(
      (q) => q && q.question && q.correctAnswer && (q.type === "mcq" || q.type === "short_answer")
    );

    if (questions.length === 0) {
      return NextResponse.json({ error: "The model didn't return any usable questions. Try again." }, { status: 502 });
    }

    const title =
      source === "custom"
        ? `${document.title} — from pasted questions`
        : `${document.title} — ${questionCount} question${questionCount === 1 ? "" : "s"} (${difficulty})`;

    const quiz = await prisma.quiz.create({
      data: {
        documentId: id,
        title,
        source,
        difficulty: source === "custom" ? null : difficulty,
        questions: {
          create: questions.map((q, i) => ({
            type: q.type,
            orderIndex: i,
            prompt: q.question,
            options: q.type === "mcq" && q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || "",
          })),
        },
      },
      include: { questions: { orderBy: { orderIndex: "asc" } } },
    });

    return NextResponse.json({ quiz });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate quiz." },
      { status: 500 }
    );
  }
}
