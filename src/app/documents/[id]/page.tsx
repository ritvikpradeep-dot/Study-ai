import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DocumentWorkspace } from "@/components/document-workspace";
import { AppShell } from "@/components/app-shell";
import { canAccessDocument, canEditDocument } from "@/lib/documents";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || !(await canAccessDocument(session.user.id, document))) notFound();

  let isHost = false;
  if (document.teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: document.teamId, userId: session.user.id } },
    });
    isHost = membership?.role === "OWNER";
  } else {
    isHost = document.userId === session.user.id;
  }

  const canEdit = await canEditDocument(session.user.id, document);

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
        teamId={document.teamId}
        isHost={isHost}
        canEdit={canEdit}
        sharedSummary={document.summary}
        summaryGeneratedAt={document.summaryGeneratedAt?.toISOString() ?? null}
      />
    </AppShell>
  );
}
