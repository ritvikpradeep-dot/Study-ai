import { prisma } from "@/lib/prisma";
import { AdminRoomsTable } from "@/components/admin-rooms-table";

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
    <AdminRoomsTable
      teams={teams.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
    />
  );
}
