import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminUsersTable } from "@/components/admin-users-table";

export default async function AdminUsersPage() {
  const session = await auth();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { documents: true, ownedTeams: true, teamMembers: true } },
    },
  });

  const serialized = users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));

  return <AdminUsersTable initialUsers={serialized} currentUserId={session!.user.id} />;
}
