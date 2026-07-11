import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { documentStoragePath, saveUploadedFile } from "@/lib/storage";
import { extractPdfText } from "@/lib/pdf";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
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

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported right now." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File is too large (max 50MB)." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const document = await prisma.document.create({
    data: {
      userId: session.user.id,
      title: file.name.replace(/\.pdf$/i, ""),
      filename: file.name,
      storagePath: "",
      fileSize: file.size,
      status: "processing",
    },
  });

  const storagePath = documentStoragePath(session.user.id, document.id, file.name);

  try {
    await saveUploadedFile(storagePath, buffer);
    const { text, pageCount } = await extractPdfText(new Uint8Array(buffer));

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        storagePath,
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
