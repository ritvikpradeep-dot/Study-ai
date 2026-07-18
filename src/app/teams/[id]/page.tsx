import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { TeamWorkspace } from "@/components/team-workspace";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/teams/${id}`);

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: id, userId: session.user.id } },
  });
  if (!membership) notFound();

  const [team, documents] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { joinedAt: "asc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.document.findMany({
      where: { teamId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        fileSize: true,
        pageCount: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);
  if (!team) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <TeamWorkspace
          team={{
            id: team.id,
            name: team.name,
            inviteCode: team.inviteCode,
            myRole: membership.role,
            closedAt: team.closedAt?.toISOString() ?? null,
            members: team.members.map((m) => ({
              id: m.user.id,
              name: m.user.name,
              email: m.user.email,
              role: m.role,
            })),
          }}
          documents={documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
        />
      </div>
    </AppShell>
  );
}
