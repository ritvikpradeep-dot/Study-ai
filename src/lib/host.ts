import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Single gate for every host-only room action (upload, timer start/stop,
// granting/revoking edit access, kicking a member, regenerating the invite
// code, closing the room). Returns the session + team on success, or null —
// callers translate null into a 401/403 with a specific message.
export async function requireHost(teamId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.ownerId !== session.user.id) return null;

  return { session, team };
}
