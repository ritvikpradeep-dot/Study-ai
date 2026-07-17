import { Users, FileText, UsersRound, Activity, MessageSquare, FileSearch, HelpCircle, CheckCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { computeActivityByDay, isWithinLastDays } from "@/lib/dashboard-stats";

const FEATURE_LABEL: Record<string, { label: string; icon: typeof MessageSquare }> = {
  chat: { label: "Chat messages", icon: MessageSquare },
  summarize: { label: "Summaries", icon: FileSearch },
  quiz_generate: { label: "Quizzes generated", icon: HelpCircle },
  quiz_grade: { label: "Answers graded", icon: CheckCheck },
};

export default async function AdminOverviewPage() {
  const [totalUsers, activeUsers, totalDocuments, totalTeams, usageLogs] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.document.count(),
    prisma.team.count(),
    prisma.aiUsageLog.findMany({
      select: { feature: true, userId: true, promptTokens: true, completionTokens: true, createdAt: true },
    }),
  ]);

  const usersActiveLast7Days = new Set(
    usageLogs.filter((l) => isWithinLastDays(l.createdAt, 7)).map((l) => l.userId)
  ).size;

  const summarizeDates = usageLogs.filter((l) => l.feature === "summarize").map((l) => l.createdAt);
  const documentsSummarizedByDay = computeActivityByDay(summarizeDates, 14);
  const maxSummarized = Math.max(1, ...documentsSummarizedByDay.map((d) => d.count));

  const tokensByFeature = usageLogs.reduce<
    Record<string, { calls: number; promptTokens: number; completionTokens: number }>
  >((acc, log) => {
    acc[log.feature] ??= { calls: 0, promptTokens: 0, completionTokens: 0 };
    acc[log.feature].calls += 1;
    acc[log.feature].promptTokens += log.promptTokens ?? 0;
    acc[log.feature].completionTokens += log.completionTokens ?? 0;
    return acc;
  }, {});

  const totalTokens = usageLogs.reduce(
    (sum, l) => sum + (l.promptTokens ?? 0) + (l.completionTokens ?? 0),
    0
  );
  const callsWithTokenData = usageLogs.filter((l) => l.promptTokens != null).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={totalUsers} sub={`${activeUsers} active`} />
        <StatCard icon={Activity} label="Active last 7 days" value={usersActiveLast7Days} />
        <StatCard icon={FileText} label="Documents" value={totalDocuments} />
        <StatCard icon={UsersRound} label="Teams" value={totalTeams} />
      </div>

      <Card className="p-5">
        <h2 className="mb-1 font-medium">Documents summarized, last 14 days</h2>
        <p className="mb-4 text-xs opacity-60">
          Counted from AI usage logs — one entry per summarize request, not per unique document.
        </p>
        <div className="flex items-end justify-between gap-1.5" style={{ height: 90 }}>
          {documentsSummarizedByDay.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t-md bg-accent transition-all"
                style={{
                  height: `${Math.max(4, (day.count / maxSummarized) * 70)}px`,
                  opacity: day.count === 0 ? 0.15 : 1,
                }}
                title={`${day.count} on ${day.date}`}
              />
              <span className="text-[9px] opacity-50">{day.label[0]}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-medium">AI usage / cost proxy</h2>
        <p className="mb-4 text-xs opacity-60">
          Token counts come from the provider&apos;s API response where available.{" "}
          {callsWithTokenData < usageLogs.length &&
            `${usageLogs.length - callsWithTokenData} of ${usageLogs.length} logged calls have no token data (streaming responses whose provider didn't report usage) — totals below are a floor, not exact cost.`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(FEATURE_LABEL).map(([key, { label, icon: Icon }]) => {
            const stats = tokensByFeature[key];
            return (
              <div key={key} className="flex items-center justify-between rounded-xl bg-black/5 px-4 py-3 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <Icon size={16} className="text-accent" />
                  <span className="text-sm">{label}</span>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{stats?.calls ?? 0} calls</p>
                  <p className="text-xs opacity-60">
                    {stats ? (stats.promptTokens + stats.completionTokens).toLocaleString() : 0} tokens
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm opacity-70">
          Total tokens logged: <span className="font-medium">{totalTokens.toLocaleString()}</span>
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-medium">Most common document topics</h2>
        <p className="text-sm opacity-70">
          Not tracked yet — no document is classified by subject anywhere in the current schema, so this
          can&apos;t be shown honestly. To support it: add a <code>topics</code> field to{" "}
          <code>Document</code>, populate it with a short AI classification call at upload time (the same
          pattern already used for summarize-for-quiz), then aggregate counts here.
        </p>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15">
        <Icon size={20} className="text-accent" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs opacity-60">
          {label}
          {sub ? ` · ${sub}` : ""}
        </p>
      </div>
    </Card>
  );
}
