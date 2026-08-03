import { prisma } from "@/lib/prisma";
import { AdminDocumentsTable } from "@/components/admin-documents-table";

export default async function AdminDocumentsPage() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileSize: true,
      pageCount: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true, shareStruggleData: true } },
      _count: { select: { quizzes: true, messages: true } },
    },
  });

  const serialized = documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }));

  return <AdminDocumentsTable initialDocuments={serialized} />;
}
