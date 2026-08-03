import Link from "next/link";
import { ArrowLeft, FileText, UsersRound, Sparkles, Activity } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Admin-only per-user activity view: what they've uploaded, which rooms
// they own/belong to, their AI feature usage, and every activity-log entry
// they've generated as an actor across every room they're in — an audit
// trail, not the content of other users' private work (see the document
// content viewer at /admin/documents/[id] for that).
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, teamId: true, createdAt: true, team: { select: { name: true } } },
      },
      ownedTeams: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, createdAt: true } },
      teamMembers: {
        orderBy: { joinedAt: "desc" },
        select: { role: true, joinedAt: true, team: { select: { id: true, name: true, ownerId: true } } },
      },
    },
  });

  if (!user) return <Card className="p-5 text-sm opacity-70">User not found.</Card>;

  const [aiUsage, activity, quizAttempts, sessions] = await Promise.all([
    prisma.aiUsageLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { feature: true, documentId: true, promptTokens: true, completionTokens: true, createdAt: true },
    }),
    prisma.activityLogEntry.findMany({
      where: { actorId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { action: true, createdAt: true, team: { select: { name: true } } },
    }),
    prisma.quizAttempt.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { score: true, total: true, createdAt: true, quiz: { select: { title: true } } },
    }),
    prisma.session.findMany({
      where: { userId: id },
      orderBy: { expires: "desc" },
      take: 5,
      select: { expires: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/users" className="flex w-fit items-center gap-1.5 text-sm opacity-70 hover:opacity-100">
        <ArrowLeft size={14} /> Back to users
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          {user.name || user.email}
          <Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role}</Badge>
          <Badge tone={user.isActive ? "success" : "danger"}>{user.isActive ? "active" : "deactivated"}</Badge>
        </h1>
        <p className="mt-1 text-sm opacity-70">
          {user.email} · joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
        {sessions.length > 0 && (
          <p className="mt-1 text-xs opacity-50">
            Most recent session expires {new Date(sessions[0].expires).toLocaleString()} — NextAuth doesn&apos;t
            record last-active timestamps, only rolling session expiry, so this is the closest available signal
            to "last seen."
          </p>
        )}
      </div>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <FileText size={16} className="text-accent" /> Documents ({user.documents.length})
        </h2>
        {user.documents.length === 0 ? (
          <p className="text-sm opacity-50">No documents uploaded.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {user.documents.map((d) => (
              <Link
                key={d.id}
                href={`/admin/documents/${d.id}`}
                className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 text-sm transition hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <span className="truncate">{d.title}</span>
                <span className="shrink-0 text-xs opacity-60">
                  {d.team ? d.team.name : "Personal"} · {new Date(d.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <UsersRound size={16} className="text-accent" /> Rooms
        </h2>
        {user.ownedTeams.length === 0 && user.teamMembers.length === 0 ? (
          <p className="text-sm opacity-50">Not in any rooms.</p>
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            {user.ownedTeams.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
                <span>{t.name}</span>
                <Badge tone="accent">Host</Badge>
              </div>
            ))}
            {user.teamMembers
              .filter((m) => m.team.ownerId !== id)
              .map((m) => (
                <div key={m.team.id} className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
                  <span>{m.team.name}</span>
                  <span className="text-xs opacity-60">joined {new Date(m.joinedAt).toLocaleDateString()}</span>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <Sparkles size={16} className="text-accent" /> AI usage ({aiUsage.length} recent calls)
        </h2>
        {aiUsage.length === 0 ? (
          <p className="text-sm opacity-50">No AI usage.</p>
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            {aiUsage.map((u, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
                <span>{u.feature}</span>
                <span className="text-xs opacity-60">{new Date(u.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <Activity size={16} className="text-accent" /> Activity log ({activity.length} recent entries)
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm opacity-50">No logged activity.</p>
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            {activity.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
                <span>
                  {a.action} <span className="opacity-50">in {a.team.name}</span>
                </span>
                <span className="text-xs opacity-60">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {quizAttempts.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 font-medium">Quiz attempts ({quizAttempts.length})</h2>
          <div className="flex flex-col gap-1.5 text-sm">
            {quizAttempts.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
                <span>{a.quiz.title}</span>
                <span className="text-xs opacity-60">
                  {a.score}/{a.total} · {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
