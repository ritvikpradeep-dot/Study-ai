"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type MyDocument = {
  id: string;
  title: string;
  fileSize: number;
  pageCount: number | null;
  status: string;
  createdAt: string;
  teamId: string | null;
};

const STATUS_TONE: Record<string, "warning" | "success" | "danger"> = {
  processing: "warning",
  ready: "success",
  error: "danger",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MyDocumentsList({ initialDocuments }: { initialDocuments: MyDocument[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function deleteDocument(doc: MyDocument) {
    const roomWarning = doc.teamId
      ? " This document is shared in a room — if it's the room's only document, the room will be disbanded for everyone in it."
      : "";
    if (
      !confirm(
        `Permanently delete "${doc.title}"? This also deletes its summaries, quizzes, notes, and annotations.${roomWarning}`
      )
    ) {
      return;
    }
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(json.error || "Failed to delete document.", "error");
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.show(json.roomDisbanded ? "Document deleted — room disbanded." : "Document deleted.", "success");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (documents.length === 0) {
    return <EmptyState title="No documents yet" description="Upload a PDF above to get started." />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {documents.map((doc) => (
        <Card key={doc.id} hover className="p-4">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/documents/${doc.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{doc.title}</p>
              <p className="mt-0.5 text-xs opacity-60">
                {formatBytes(doc.fileSize)}
                {doc.pageCount ? ` · ${doc.pageCount} pages` : ""} ·{" "}
                {new Date(doc.createdAt).toLocaleDateString()}
              </p>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={STATUS_TONE[doc.status] ?? "neutral"}>{doc.status}</Badge>
              <button
                onClick={() => deleteDocument(doc)}
                disabled={busyId === doc.id}
                aria-label="Delete document"
                title="Delete document"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
