import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame, FileText, ChartColumn, Sparkles, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UploadDropzone } from "@/components/upload-dropzone";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/reveal";
import { MyDocumentsList } from "@/components/my-documents-list";
import { computeStreak, computeActivityByDay, isWithinLastDays } from "@/lib/dashboard-stats";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  const [documents, attempts] = await Promise.all([
    prisma.document.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { quizzes: true } } },
    }),
    prisma.quizAttempt.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { quiz: { include: { document: { select: { id: true, title: true } } } } },
    }),
  ]);

  const activityDates = [...documents.map((d) => d.createdAt), ...attempts.map((a) => a.createdAt)];
  const streak = computeStreak(activityDates);
  const activity = computeActivityByDay(activityDates);
  const maxActivity = Math.max(1, ...activity.map((a) => a.count));

  const weeklyQuizzes = attempts.filter((a) => isWithinLastDays(a.createdAt, 7)).length;
  const weeklyUploads = documents.filter((d) => isWithinLastDays(d.createdAt, 7)).length;

  const lowScoreAttempt = attempts.find((a) => a.total > 0 && a.score / a.total < 0.6);
  const docWithoutQuiz = documents.find((d) => d.status === "ready" && d._count.quizzes === 0);

  const continueDoc = documents[0];

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
        <Reveal>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back{session.user.name ? `, ${session.user.name}` : ""}
            </h1>
            <p className="mt-1 text-sm opacity-70">
              {documents.length} document{documents.length === 1 ? "" : "s"} uploaded
            </p>
          </div>
        </Reveal>

        {/* Stat cards */}
        <Reveal delay={80}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/15">
                <Flame size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{streak}</p>
                <p className="text-xs opacity-60">day streak</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
                <FileText size={20} className="text-accent" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{weeklyUploads}</p>
                <p className="text-xs opacity-60">uploads this week</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15">
                <ChartColumn size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{weeklyQuizzes}</p>
                <p className="text-xs opacity-60">quizzes this week</p>
              </div>
            </Card>
          </div>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Continue studying + upload */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Reveal delay={120}>
              <div>
                <h2 className="mb-3 text-lg font-medium">Continue studying</h2>
                {continueDoc ? (
                  <Card hover className="p-5">
                    <Link href={`/documents/${continueDoc.id}`} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{continueDoc.title}</p>
                        <p className="mt-0.5 text-xs opacity-60">
                          {formatBytes(continueDoc.fileSize)}
                          {continueDoc.pageCount ? ` · ${continueDoc.pageCount} pages` : ""}
                        </p>
                      </div>
                      <ArrowRight size={18} className="shrink-0 text-accent" />
                    </Link>
                  </Card>
                ) : (
                  <EmptyState title="Nothing to continue yet" description="Upload your first PDF to get started." />
                )}
              </div>
            </Reveal>

            <Reveal delay={160}>
              <div>
                <h2 className="mb-3 text-lg font-medium">Upload a document</h2>
                <UploadDropzone />
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div>
                <h2 className="mb-3 text-lg font-medium">Your documents</h2>
                <MyDocumentsList
                  initialDocuments={documents.map((d) => ({
                    id: d.id,
                    title: d.title,
                    fileSize: d.fileSize,
                    pageCount: d.pageCount,
                    status: d.status,
                    createdAt: d.createdAt.toISOString(),
                    teamId: d.teamId,
                  }))}
                />
              </div>
            </Reveal>
          </div>

          {/* Sidebar: activity + recommendation */}
          <div className="flex flex-col gap-6">
            <Reveal delay={140}>
              <Card className="p-5">
                <h2 className="mb-4 font-medium">This week</h2>
                <div className="flex items-end justify-between gap-1.5" style={{ height: 80 }}>
                  {activity.map((day) => (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                      <div
                        className="w-full rounded-t-md bg-accent transition-all"
                        style={{
                          height: `${Math.max(4, (day.count / maxActivity) * 60)}px`,
                          opacity: day.count === 0 ? 0.15 : 1,
                        }}
                      />
                      <span className="text-[10px] opacity-50">{day.label[0]}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>

            <Reveal delay={180}>
              <Card className="p-5">
                <h2 className="mb-3 flex items-center gap-1.5 font-medium">
                  <Sparkles size={16} className="text-accent" /> Recommended for you
                </h2>
                {lowScoreAttempt ? (
                  <div className="text-sm">
                    <p className="opacity-70">
                      You scored {lowScoreAttempt.score}/{lowScoreAttempt.total} on a quiz for{" "}
                      <span className="font-medium">{lowScoreAttempt.quiz.document.title}</span>. Worth
                      another attempt.
                    </p>
                    <Button
                      href={`/documents/${lowScoreAttempt.quiz.document.id}`}
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                    >
                      Retake quiz
                    </Button>
                  </div>
                ) : docWithoutQuiz ? (
                  <div className="text-sm">
                    <p className="opacity-70">
                      <span className="font-medium">{docWithoutQuiz.title}</span> doesn&apos;t have a
                      quiz yet — test yourself on it.
                    </p>
                    <Button href={`/documents/${docWithoutQuiz.id}`} size="sm" variant="secondary" className="mt-3">
                      Generate quiz
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm opacity-60">You&apos;re all caught up — nice work.</p>
                )}
              </Card>
            </Reveal>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
