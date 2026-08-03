import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { computeActivityByDay, isWithinLastDays, daysAgo } from "@/lib/dashboard-stats";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sevenDaysAgo = daysAgo(7);

  const [
    totalUsers,
    activeUsers,
    totalDocuments,
    totalTeams,
    usageLogs,
    recentRoomMessages,
    recentTeamDocuments,
    soloActivityCount,
    openRooms,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.document.count(),
    prisma.team.count(),
    prisma.aiUsageLog.findMany({
      select: { feature: true, userId: true, promptTokens: true, completionTokens: true, createdAt: true },
    }),
    prisma.roomMessage.findMany({ where: { createdAt: { gte: sevenDaysAgo } }, select: { teamId: true } }),
    prisma.document.findMany({
      where: { teamId: { not: null }, createdAt: { gte: sevenDaysAgo } },
      select: { teamId: true },
    }),
    prisma.document.count({
      where: {
        teamId: null,
        OR: [{ notes: { some: {} } }, { highlights: { some: {} } }, { drawings: { some: {} } }],
      },
    }),
    prisma.team.count({ where: { closedAt: null } }),
  ]);

  const activeRooms = new Set([
    ...recentRoomMessages.map((m) => m.teamId),
    ...recentTeamDocuments.map((d) => d.teamId as string),
  ]).size;

  const usersActiveLast7Days = new Set(
    usageLogs.filter((l) => isWithinLastDays(l.createdAt, 7)).map((l) => l.userId)
  ).size;
  const usersActiveLast24h = new Set(
    usageLogs.filter((l) => isWithinLastDays(l.createdAt, 1)).map((l) => l.userId)
  ).size;

  const summarizeDates = usageLogs.filter((l) => l.feature === "summarize").map((l) => l.createdAt);
  const documentsSummarizedByDay = computeActivityByDay(summarizeDates, 14);

  const tokensByFeature = usageLogs.reduce<Record<string, { calls: number; promptTokens: number; completionTokens: number }>>(
    (acc, log) => {
      const key = log.feature;
      acc[key] ??= { calls: 0, promptTokens: 0, completionTokens: 0 };
      acc[key].calls += 1;
      acc[key].promptTokens += log.promptTokens ?? 0;
      acc[key].completionTokens += log.completionTokens ?? 0;
      return acc;
    },
    {}
  );

  const totalCallsLogged = usageLogs.length;
  const callsWithTokenData = usageLogs.filter((l) => l.promptTokens != null).length;

  return NextResponse.json({
    totalUsers,
    activeUsers,
    usersActiveLast7Days,
    usersActiveLast24h,
    totalDocuments,
    totalTeams,
    openRooms,
    activeRooms,
    soloActivityCount,
    documentsSummarizedByDay,
    tokensByFeature,
    totalCallsLogged,
    callsWithTokenData,
    // Topic tagging doesn't exist yet — no document is classified by subject
    // anywhere in the schema, so "most common topics" can't be computed
    // honestly. To support it: add a `topics: String[]` field to Document,
    // populate it with a short AI classification call at upload time (same
    // pattern as summarizeForQuiz in the quiz route), then aggregate here.
    topicsTracked: false,
  });
}
