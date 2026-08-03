import Link from "next/link";
import { ArrowLeft, UsersRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminRoomLiveView } from "@/components/admin-room-live-view";

export default async function AdminRoomLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true } },
      members: { include: { user: { select: { name: true, email: true } } } },
      documents: { select: { id: true, title: true } },
    },
  });

  if (!team) return <Card className="p-5 text-sm opacity-70">Room not found.</Card>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/rooms" className="flex w-fit items-center gap-1.5 text-sm opacity-70 hover:opacity-100">
        <ArrowLeft size={14} /> Back to rooms
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <UsersRound size={20} className="text-accent" /> {team.name}
          {team.closedAt && <Badge tone="danger">Closed</Badge>}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          Hosted by {team.owner.name || team.owner.email} · {team.members.length} member
          {team.members.length === 1 ? "" : "s"} ·{" "}
          {team.members.map((m) => m.user.name || m.user.email).join(", ")}
        </p>
        <p className="mt-1 text-xs opacity-50">
          You're observing this room without joining it — members can't see you're watching.
        </p>
      </div>

      {team.documents.length > 0 && (
        <Card className="p-4 text-sm">
          <p className="mb-1.5 font-medium">Documents</p>
          <div className="flex flex-col gap-1">
            {team.documents.map((d) => (
              <Link key={d.id} href={`/admin/documents/${d.id}`} className="opacity-70 hover:opacity-100 hover:underline">
                {d.title}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <AdminRoomLiveView teamId={team.id} />
    </div>
  );
}
