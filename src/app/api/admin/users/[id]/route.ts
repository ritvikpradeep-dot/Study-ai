import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You can't change your own account's role or active status." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const data: { isActive?: boolean; role?: "USER" | "ADMIN" } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.role === "USER" || body.role === "ADMIN") data.role = body.role;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "You can't remove your own account." }, { status: 400 });
  }

  // Note: this deletes the DB row (and cascades their documents/quizzes/teams)
  // but does not clean up their files in Vercel Blob — acceptable for a
  // rarely-used admin action, but worth a follow-up if this account gets real
  // usage.
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
