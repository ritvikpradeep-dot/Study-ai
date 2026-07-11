import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PdfViewer } from "@/components/pdf-viewer";
import { DocumentTabs } from "@/components/document-tabs";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.userId !== session.user.id) notFound();

  if (document.status === "processing") {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-lg font-medium">Still processing this PDF…</p>
        <p className="mt-2 text-sm opacity-60">Refresh in a moment.</p>
      </div>
    );
  }

  if (document.status === "error") {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-lg font-medium text-red-500">Failed to process this PDF</p>
        <p className="mt-2 text-sm opacity-60">{document.errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl gap-4 px-4 py-4">
      <div className="flex-1 min-w-0">
        <PdfViewer documentId={document.id} pageCount={document.pageCount} />
      </div>
      <div className="w-[380px] shrink-0">
        <DocumentTabs documentId={document.id} title={document.title} />
      </div>
    </div>
  );
}
