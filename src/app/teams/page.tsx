import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { TeamsList } from "@/components/teams-list";
import { MAX_TEAM_MEMBERS } from "@/lib/teams";

export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/teams");

  const memberships = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    include: {
      team: {
        include: { _count: { select: { members: true, documents: true } } },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const teams = memberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    myRole: m.role,
    memberCount: m.team._count.members,
    maxMembers: MAX_TEAM_MEMBERS,
    documentCount: m.team._count.documents,
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <TeamsList initialTeams={teams} />
      </div>
    </AppShell>
  );
}
