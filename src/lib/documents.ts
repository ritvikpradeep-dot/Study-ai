import { prisma } from "@/lib/prisma";

type DocumentAccessInfo = { userId: string; teamId: string | null };

export async function canAccessDocument(userId: string, document: DocumentAccessInfo) {
  if (document.userId === userId) return true;
  if (!document.teamId) return false;
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: document.teamId, userId } },
  });
  return Boolean(membership);
}

// Stricter than canAccessDocument: for destructive actions (delete). Any
// team member can use a shared document, but only the uploader or the
// team's owner can remove it.
export async function canManageDocument(userId: string, document: DocumentAccessInfo) {
  if (document.userId === userId) return true;
  if (!document.teamId) return false;
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: document.teamId, userId } },
  });
  return membership?.role === "OWNER";
}

// Gates annotation writes (highlights/notes/drawings/sticky notes). Solo
// documents: only the owner can ever access them, so they can always edit.
// Room documents: the host can always edit; other members need an explicit
// EditPermission grant (default is view-only).
export async function canEditDocument(userId: string, document: DocumentAccessInfo) {
  if (document.userId === userId) return true;
  if (!document.teamId) return false;

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: document.teamId, userId } },
  });
  if (!membership) return false;
  if (membership.role === "OWNER") return true;

  const permission = await prisma.editPermission.findUnique({
    where: { teamId_userId: { teamId: document.teamId, userId } },
  });
  return permission?.canEdit === true;
}
