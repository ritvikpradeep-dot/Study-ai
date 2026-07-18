import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MAX_TEAM_MEMBERS } from "@/lib/teams";

export default async function AdminRoomsPage() {
  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { name: true, email: true } },
      members: { include: { user: { select: { name: true, email: true } } } },
      _count: { select: { documents: true } },
    },
  });

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide opacity-60 dark:border-white/10">
            <th className="px-4 py-3 font-medium">Room</th>
            <th className="px-4 py-3 font-medium">Host</th>
            <th className="px-4 py-3 font-medium">Members</th>
            <th className="px-4 py-3 font-medium">Docs</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
              <td className="px-4 py-3">
                <p className="font-medium">{t.name}</p>
              </td>
              <td className="px-4 py-3 text-xs">{t.owner.name || t.owner.email}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1">
                  <Badge tone="neutral">{t.members.length}/{MAX_TEAM_MEMBERS}</Badge>
                  <span className="text-xs opacity-60">
                    {t.members.map((m) => m.user.name || m.user.email).join(", ")}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs opacity-70">{t._count.documents}</td>
              <td className="px-4 py-3 text-xs opacity-60">{new Date(t.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
