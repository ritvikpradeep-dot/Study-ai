import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DocumentWorkspace } from "@/components/document-workspace";
import { AppShell } from "@/components/app-shell";

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
      <AppShell>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="text-lg font-medium">Still processing this PDF…</p>
          <p className="mt-2 text-sm opacity-60">Refresh in a moment.</p>
        </div>
      </AppShell>
    );
  }

  if (document.status === "error") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="text-lg font-medium text-red-500">Failed to process this PDF</p>
          <p className="mt-2 text-sm opacity-60">{document.errorMessage}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <DocumentWorkspace
        documentId={document.id}
        title={document.title}
        pageCount={document.pageCount}
      />
    </AppShell>
  );
}
