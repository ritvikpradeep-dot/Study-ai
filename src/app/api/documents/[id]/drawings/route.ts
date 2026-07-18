import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDocument, canEditDocument } from "@/lib/documents";
import { colorForAuthor } from "@/lib/annotation-colors";
import { logActivity } from "@/lib/activity";
import { notifyTeam } from "@/lib/pusher-server";

const VALID_TOOLS = ["PEN", "RECTANGLE", "CIRCLE", "ARROW"];
const VALID_PEN_TYPES = ["PEN", "HIGHLIGHTER", "MARKER"];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

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
      penType: d.penType,
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
  if (!(await canEditDocument(session.user.id, document))) {
    return NextResponse.json(
      { error: "You have view-only access to this document. Ask the host to grant you edit access." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const tool = typeof body.tool === "string" && VALID_TOOLS.includes(body.tool) ? body.tool : null;
  const penType =
    typeof body.penType === "string" && VALID_PEN_TYPES.includes(body.penType) ? body.penType : "PEN";
  const page = Number.isInteger(body.page) ? body.page : 1;
  const points = Array.isArray(body.pathData) ? body.pathData : null;
  const strokeWidth =
    Number.isInteger(body.strokeWidth) && body.strokeWidth >= 1 && body.strokeWidth <= 24
      ? body.strokeWidth
      : 3;
  const color =
    typeof body.color === "string" && HEX_COLOR.test(body.color)
      ? body.color
      : colorForAuthor(session.user.id);

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
      penType,
      pathData: points,
      color,
      strokeWidth,
    },
  });

  if (document.teamId) {
    await logActivity({
      teamId: document.teamId,
      actorId: session.user.id,
      action: "DRAWING_ADDED",
      metadata: { documentId: id, page },
    });
    await notifyTeam(document.teamId, "drawing-added", { documentId: id, drawing });
  }

  return NextResponse.json({ drawing });
}
