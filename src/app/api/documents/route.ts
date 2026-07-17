import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { documentBlobPath, saveUploadedFile } from "@/lib/storage";
import { extractPdfText } from "@/lib/pdf";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");

  let where: { userId: string; teamId: null } | { teamId: string };
  if (teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.user.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this team." }, { status: 403 });
    }
    where = { teamId };
  } else {
    // Personal documents only — team documents are opt-in and fetched via ?teamId=.
    where = { userId: session.user.id, teamId: null };
  }

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      filename: true,
      fileSize: true,
      pageCount: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const teamId = formData.get("teamId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported right now." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File is too large (max 50MB)." }, { status: 400 });
  }

  let resolvedTeamId: string | null = null;
  if (typeof teamId === "string" && teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: session.user.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this team." }, { status: 403 });
    }
    resolvedTeamId = teamId;
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const document = await prisma.document.create({
    data: {
      userId: session.user.id,
      teamId: resolvedTeamId,
      title: file.name.replace(/\.pdf$/i, ""),
      filename: file.name,
      storageUrl: "",
      fileSize: file.size,
      status: "processing",
    },
  });

  const blobPath = documentBlobPath(session.user.id, document.id, file.name);

  try {
    const storageUrl = await saveUploadedFile(blobPath, buffer);
    const { text, pageCount } = await extractPdfText(new Uint8Array(buffer));

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        storageUrl,
        pageCount,
        textContent: text,
        status: "ready",
      },
    });

    return NextResponse.json({ document: updated });
  } catch (err) {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Failed to process PDF.",
      },
    });
    return NextResponse.json({ error: "Failed to process the PDF." }, { status: 500 });
  }
}
