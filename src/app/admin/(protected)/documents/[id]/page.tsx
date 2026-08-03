import Link from "next/link";
import { ArrowLeft, MessageSquare, StickyNote, Highlighter, HelpCircle, MessagesSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

// Admin-only, read-only content view — deliberately bypasses the normal
// canAccessDocument/canEditDocument checks (those gate the actual product
// UI for regular users) so an admin can review any document's content,
// solo or room, for moderation/support purposes.
export default async function AdminDocumentContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
      notes: {
        orderBy: { updatedAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      },
      highlights: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, email: true } } },
      },
      messages: { orderBy: { createdAt: "asc" } },
      quizzes: {
        include: {
          attempts: {
            orderBy: { createdAt: "desc" },
            include: { quiz: false },
          },
        },
      },
    },
  });

  if (!document) {
    return <Card className="p-5 text-sm opacity-70">Document not found.</Card>;
  }

  const roomMessages = document.teamId
    ? await prisma.roomMessage.findMany({
        where: { teamId: document.teamId },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      })
    : [];

  const attemptUserIds = [
    ...new Set(document.quizzes.flatMap((q) => q.attempts.map((a) => a.userId))),
  ];
  const attemptUsers = attemptUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: attemptUserIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const attemptUserById = new Map(attemptUsers.map((u) => [u.id, u]));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/documents" className="flex w-fit items-center gap-1.5 text-sm opacity-70 hover:opacity-100">
        <ArrowLeft size={14} /> Back to documents
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{document.title}</h1>
        <p className="mt-1 text-sm opacity-70">
          Uploaded by {document.user.name || document.user.email}
          {document.team ? ` · room "${document.team.name}"` : " · personal document"}
        </p>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <MessageSquare size={16} className="text-accent" /> AI chat ({document.messages.length})
        </h2>
        {document.messages.length === 0 ? (
          <p className="text-sm opacity-50">No chat messages.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {document.messages.map((m) => (
              <div key={m.id} className="rounded-xl bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                <p className="mb-0.5 text-xs font-medium uppercase tracking-wide opacity-50">{m.role}</p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <StickyNote size={16} className="text-accent" /> Notes ({document.notes.length})
        </h2>
        {document.notes.length === 0 ? (
          <p className="text-sm opacity-50">No notes.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {document.notes.map((n) => (
              <div key={n.id} className="rounded-xl bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                <p className="mb-0.5 text-xs opacity-50">{n.user.name || n.user.email}</p>
                <p className="whitespace-pre-wrap">{n.content || "(empty)"}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <Highlighter size={16} className="text-accent" /> Highlights ({document.highlights.length})
        </h2>
        {document.highlights.length === 0 ? (
          <p className="text-sm opacity-50">No highlights.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {document.highlights.map((h) => (
              <div key={h.id} className="rounded-xl bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                <p className="mb-0.5 text-xs opacity-50">
                  {h.author.name || h.author.email} · page {h.page}
                </p>
                <p className="whitespace-pre-wrap">&ldquo;{h.textSnippet}&rdquo;</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {document.teamId && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-1.5 font-medium">
            <MessagesSquare size={16} className="text-accent" /> Room chat ({roomMessages.length})
          </h2>
          {roomMessages.length === 0 ? (
            <p className="text-sm opacity-50">No room chat messages.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {roomMessages.map((m) => (
                <div key={m.id} className="rounded-xl bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                  <p className="mb-0.5 text-xs opacity-50">{m.author.name || m.author.email}</p>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-medium">
          <HelpCircle size={16} className="text-accent" /> Quiz attempts
        </h2>
        {document.quizzes.every((q) => q.attempts.length === 0) ? (
          <p className="text-sm opacity-50">No quiz attempts.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {document.quizzes.flatMap((q) =>
              q.attempts.map((a) => {
                const attemptUser = attemptUserById.get(a.userId);
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                    <span>{attemptUser?.name || attemptUser?.email || "Unknown user"}</span>
                    <span className="opacity-70">
                      {a.score}/{a.total} · {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
