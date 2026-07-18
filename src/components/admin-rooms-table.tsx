"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MAX_TEAM_MEMBERS } from "@/lib/teams";
import { useInterfaceMode } from "@/lib/interface-mode";

type AdminRoom = {
  id: string;
  name: string;
  createdAt: string;
  owner: { name: string | null; email: string };
  members: { user: { name: string | null; email: string } }[];
  _count: { documents: number };
};

export function AdminRoomsTable({ teams }: { teams: AdminRoom[] }) {
  const { mode } = useInterfaceMode();

  if (mode === "mobile") {
    return (
      <div className="flex flex-col gap-3">
        {teams.map((t) => (
          <Card key={t.id} className="p-4">
            <p className="font-medium">{t.name}</p>
            <p className="text-xs opacity-60">Hosted by {t.owner.name || t.owner.email}</p>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="opacity-60">Members</dt>
              <dd className="text-right">
                <Badge tone="neutral">
                  {t.members.length}/{MAX_TEAM_MEMBERS}
                </Badge>
              </dd>
              <dt className="opacity-60">Docs</dt>
              <dd className="text-right">{t._count.documents}</dd>
              <dt className="opacity-60">Created</dt>
              <dd className="text-right">{new Date(t.createdAt).toLocaleDateString()}</dd>
            </dl>
            <p className="mt-2 text-xs opacity-60">
              {t.members.map((m) => m.user.name || m.user.email).join(", ")}
            </p>
          </Card>
        ))}
      </div>
    );
  }

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
