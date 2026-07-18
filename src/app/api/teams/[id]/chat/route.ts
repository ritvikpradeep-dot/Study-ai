import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireMembership(teamId: string, userId: string) {
  return prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await requireMembership(id, session.user.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const afterId = searchParams.get("after");

  const messages = await prisma.roomMessage.findMany({
    where: { teamId: id },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  const filtered = afterId
    ? messages.slice(messages.findIndex((m) => m.id === afterId) + 1)
    : messages;

  return NextResponse.json({
    messages: filtered.map((m) => ({
      id: m.id,
      content: m.content,
      authorId: m.author.id,
      authorName: m.author.name || m.author.email,
      isMine: m.author.id === session.user.id,
      createdAt: m.createdAt,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await requireMembership(id, session.user.id);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  if (content.length > 4000) {
    return NextResponse.json({ error: "Message is too long (max 4,000 characters)." }, { status: 400 });
  }

  const message = await prisma.roomMessage.create({
    data: { teamId: id, authorId: session.user.id, content },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    message: {
      id: message.id,
      content: message.content,
      authorId: message.author.id,
      authorName: message.author.name || message.author.email,
      isMine: true,
      createdAt: message.createdAt,
    },
  });
}
