import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument } from "@/lib/documents";
import { colorForAuthor } from "@/lib/annotation-colors";

const VALID_TOOLS = ["PEN", "RECTANGLE", "CIRCLE", "ARROW"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const drawings = await prisma.drawing.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({
    drawings: drawings.map((d) => ({
      id: d.id,
      page: d.page,
      tool: d.tool,
      pathData: d.pathData,
      color: d.color,
      strokeWidth: d.strokeWidth,
      authorId: d.author.id,
      isMine: d.author.id === session.user.id,
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

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || !(await canAccessDocument(session.user.id, document))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const tool = typeof body.tool === "string" && VALID_TOOLS.includes(body.tool) ? body.tool : null;
  const page = Number.isInteger(body.page) ? body.page : 1;
  const points = Array.isArray(body.pathData) ? body.pathData : null;

  if (!tool || !points || points.length < 2) {
    return NextResponse.json({ error: "Invalid drawing data." }, { status: 400 });
  }
  const validPoints = points.every(
    (p: { x?: unknown; y?: unknown }) =>
      p &&
      typeof p.x === "number" &&
      typeof p.y === "number" &&
      p.x >= 0 &&
      p.x <= 1 &&
      p.y >= 0 &&
      p.y <= 1
  );
  if (!validPoints || points.length > 2000) {
    return NextResponse.json({ error: "Invalid drawing data." }, { status: 400 });
  }

  const drawing = await prisma.drawing.create({
    data: {
      documentId: id,
      authorId: session.user.id,
      page,
      tool,
      pathData: points,
      color: colorForAuthor(session.user.id),
      strokeWidth: 3,
    },
  });

  return NextResponse.json({ drawing });
}
