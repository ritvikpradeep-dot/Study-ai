import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateJson, isAiConfigured, logAiUsage } from "@/lib/ai";
import { canAccessDocument } from "@/lib/documents";

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
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { document: { select: { userId: true, teamId: true } } },
  });
  if (!quiz || !(await canAccessDocument(session.user.id, quiz.document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const questionId = typeof body.questionId === "string" ? body.questionId : "";
  const userAnswer = typeof body.userAnswer === "string" ? body.userAnswer.trim() : "";

  const question = await prisma.quizQuestion.findUnique({ where: { id: questionId } });
  if (!question || question.quizId !== id) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  if (!userAnswer) {
    return NextResponse.json({
      correct: false,
      feedback: "No answer given.",
    });
  }

  try {
    const result = await generateJson<{ correct: boolean; feedback: string }>({
      system:
        "You are grading a student's short-answer response. Judge whether it captures the correct meaning, not whether it matches word-for-word — accept paraphrases, synonyms, and partially complete answers that still show correct understanding. Respond with ONLY valid JSON, no markdown fences: {\"correct\": boolean, \"feedback\": string (1-2 sentences, encouraging but honest, explain what was right or missing)}",
      user: `Question: ${question.prompt}\n\nCanonical correct answer: ${question.correctAnswer}\nExplanation: ${question.explanation}\n\nStudent's answer: ${userAnswer}`,
      maxTokens: 1200,
      onUsage: (usage) =>
        logAiUsage({ userId: session.user.id, documentId: quiz.documentId, feature: "quiz_grade", usage }),
    });

    return NextResponse.json({
      correct: Boolean(result.correct),
      feedback: result.feedback || "",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to grade answer." },
      { status: 500 }
    );
  }
}
