import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { HeatmapView } from "@/components/heatmap-view";

export default async function DocumentHeatmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      pageCount: true,
      team: { select: { id: true, name: true, shareStruggleData: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/documents" className="flex w-fit items-center gap-1.5 text-sm opacity-70 hover:opacity-100">
        <ArrowLeft size={14} /> Back to documents
      </Link>

      {!document ? (
        <Card className="p-5 text-sm opacity-70">Document not found.</Card>
      ) : !document.team?.shareStruggleData ? (
        <Card className="p-5 text-sm opacity-70">
          <p className="font-medium text-[var(--foreground)]">No struggle data for this document.</p>
          <p className="mt-1">
            {document.team
              ? `"${document.team.name}" hasn't opted into struggle-data sharing for this room.`
              : "This is a personal (solo) document — struggle data is only aggregated for rooms that opted in."}
          </p>
        </Card>
      ) : (
        <HeatmapView documentId={id} />
      )}
    </div>
  );
}
