import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/documents";

type AnswerInput = {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  feedback?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { document: { select: { userId: true, teamId: true } }, questions: true },
  });
  if (!quiz || !(await canAccessDocument(session.user.id, quiz.document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const answers: AnswerInput[] = Array.isArray(body.answers) ? body.answers : [];
  const validQuestionIds = new Set(quiz.questions.map((q) => q.id));
  const cleanAnswers = answers.filter((a) => validQuestionIds.has(a.questionId));

  const score = cleanAnswers.filter((a) => a.isCorrect).length;

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId: id,
      userId: session.user.id,
      score,
      total: quiz.questions.length,
      answers: {
        create: cleanAnswers.map((a) => ({
          questionId: a.questionId,
          userAnswer: a.userAnswer,
          isCorrect: a.isCorrect,
          feedback: a.feedback ?? null,
        })),
      },
    },
    include: { answers: true },
  });

  return NextResponse.json({ attempt });
}
